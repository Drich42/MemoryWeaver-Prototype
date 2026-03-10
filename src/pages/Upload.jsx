import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, X, Check, Search, Calendar, MapPin, Tag, Users, ZoomIn, FolderOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DateRangePicker from '../components/DateRangePicker';
import PlacePicker from '../components/PlacePicker';
import ImageZoomModal from '../components/ImageZoomModal';

export default function UploadWorkflow() {
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Image Review State
  const [viewingImage, setViewingImage] = useState(null);

  // Batch Data 
  // Each file will be an object: { file, previewUrl, title, type }
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Process a single file into our batch format
  const processFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      // Auto-generate title
      let fileName = file.name;
      const lastDot = fileName.lastIndexOf('.');
      if (lastDot !== -1) fileName = fileName.substring(0, lastDot);

      reader.onloadend = () => {
        resolve({
          file,
          previewUrl: reader.result,
          title: fileName,
          type: 'photo' // Default type
        });
      };

      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        resolve({
          file,
          previewUrl: 'file_selected',
          title: fileName,
          type: 'document'
        });
      }
    });
  };

  const handleFilesSelect = async (files) => {
    if (!files || files.length === 0) return;

    // Process all dropped/selected files
    const newFiles = await Promise.all(Array.from(files).map(processFile));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const handleUpdateFileBatch = (index, field, value) => {
    const updated = [...selectedFiles];
    updated[index][field] = value;
    setSelectedFiles(updated);
  };

  const handleRemoveFile = (index) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
  };


  // Person mapping features removed for simplified batch ingest

  const handleCreateMemory = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      // Create all memory nodes first
      // Create all memory nodes sequentially, waiting for storage uploads
      const memoryInserts = [];

      // Get User ID once before the loop to prevent network hanging
      console.log("Starting batch ingest...");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const uploaderId = userData.user?.id;
      console.log("Got user ID:", uploaderId);

      for (const fileItem of selectedFiles) {
        let artifact_url = fileItem.previewUrl;
        console.log(`Processing ${fileItem.title}...`);

        // Upload to Storage if actual file exists
        if (fileItem.file && fileItem.file.name) {
          const fileExt = fileItem.file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

          console.log(`Uploading to storage as ${fileName}...`);
          const { error: uploadError } = await supabase.storage
            .from('artifacts')
            .upload(fileName, fileItem.file);

          if (uploadError) {
            console.error("Storage upload failed:", uploadError);
            throw uploadError;
          }

          const { data: urlData } = supabase.storage.from('artifacts').getPublicUrl(fileName);
          artifact_url = urlData.publicUrl;
          console.log(`Got public URL:`, artifact_url);
        }

        memoryInserts.push({
          title: fileItem.title,
          type: fileItem.type,
          status: 'draft',
          artifact_url: artifact_url,
          uploader_id: uploaderId
        });
      }

      const { data: memoryData, error: memError } = await supabase
        .from('memories')
        .insert(memoryInserts)
        .select('id');

      if (memError) throw memError;

      setStep(2); // Success Step
    } catch (err) {
      console.error("Batch upload failed:", err);
      alert("Failed to create memories. See console.");
    } finally {
      setIsUploading(false);
    }
  };

  // Modals removed for simplified flow

  return (
    <div className="max-w-3xl mx-auto py-4 md:py-8 animate-in fade-in duration-500 relative">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-sepia-900">Ingest Artifacts</h1>
        <p className="text-sepia-600 mt-2">Upload files directly to your archive. Tagging and organizing can be done later in detail.</p>
      </div>

      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-sepia-200 -z-10 rounded-full"></div>
        {[1, 2].map((s) => (
          <div key={s} className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl transition-colors duration-300 ${step >= s ? 'bg-sepia-800 text-sepia-50' : 'bg-sepia-100 text-sepia-400 border-2 border-sepia-200'}`}>
            {step > s ? <Check size={24} /> : s}
          </div>
        ))}
      </div>

      <div className="bg-[var(--color-paper)] border border-sepia-200 rounded-2xl p-4 md:p-8 shadow-sm relative z-0">

        {step === 1 && (
          <form className="space-y-6">

            {/* Multi-file Dropzone */}
            <div
              onClick={() => document.getElementById('artifact-upload').click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFilesSelect(e.dataTransfer.files);
                }
              }}
              className={`border-2 border-dashed ${isDragging ? 'border-sepia-600 bg-sepia-100' : 'border-sepia-300 hover:bg-sepia-50'} rounded-xl p-10 text-center transition-all cursor-pointer group relative overflow-hidden`}
            >
              <UploadIcon size={48} className={`mx-auto mb-4 ${isDragging ? 'text-sepia-600 scale-110' : 'text-sepia-400'} group-hover:text-sepia-600 group-hover:scale-110 transition-all`} />
              <h3 className="text-lg font-medium text-sepia-900 mb-1">
                {isDragging ? 'Drop Files Here' : 'Select Artifacts'}
              </h3>
              <p className="text-sepia-500 text-sm">Drag & drop photos, videos, or documents here, or click to browse</p>

              <input
                type="file"
                id="artifact-upload"
                className="hidden"
                multiple
                accept="image/*,video/*,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelect(e.target.files);
                  }
                }}
              />
            </div>

            {/* Batch Grid */}
            {selectedFiles.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-sepia-200">
                <h3 className="font-serif font-bold text-sepia-900 flex items-center gap-2">
                  <Tag size={18} className="text-sepia-500" />
                  Batch Items ({selectedFiles.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedFiles.map((item, index) => (
                    <div key={index} className="bg-sepia-50 border border-sepia-200 rounded-lg p-3 flex gap-4 relative group animate-in slide-in-from-bottom-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                      >
                        <X size={14} />
                      </button>

                      <div className="w-20 h-20 bg-[var(--color-paper)] rounded border border-sepia-300 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {item.previewUrl && item.previewUrl !== 'file_selected' ? (
                          <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <UploadIcon className="text-sepia-300" size={24} />
                        )}
                      </div>

                      <div className="flex-1 space-y-2 min-w-0">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateFileBatch(index, 'title', e.target.value)}
                          className="w-full text-sm font-medium bg-transparent border-b border-sepia-300 focus:border-sepia-600 focus:outline-none truncate py-1 text-sepia-900"
                          placeholder="Artifact Title"
                        />
                        <select
                          value={item.type}
                          onChange={(e) => handleUpdateFileBatch(index, 'type', e.target.value)}
                          className="w-full text-xs bg-[var(--color-paper)] border border-sepia-300 rounded p-1 text-sepia-700 focus:outline-none"
                        >
                          <option value="photo">Photograph</option>
                          <option value="document">Document / Letter</option>
                          <option value="video">Video</option>
                          <option value="audio">Audio / Oral History</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={handleCreateMemory}
                disabled={selectedFiles.length === 0 || isUploading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-sepia-800 text-sepia-50 px-8 py-3 rounded-lg font-medium hover:bg-sepia-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
              >
                <UploadIcon size={18} /> {isUploading ? 'Ingesting Batch...' : 'Upload to Archive'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="text-center py-12 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="stroke-[3]" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-sepia-900 mb-2">Artifacts Ingested</h2>
            <p className="text-sepia-600 mb-8 max-w-md mx-auto">Your batch of memory nodes has been successfully saved to your archive as drafts.</p>

            <div className="flex justify-center gap-4">
              <button onClick={() => window.location.href = '/archives'} className="px-6 py-2.5 bg-sepia-100 text-sepia-900 rounded-lg font-medium hover:bg-sepia-200 transition-colors">
                View Archive
              </button>
              <button onClick={() => { setStep(1); setSelectedFiles([]); }} className="px-6 py-2.5 bg-sepia-800 text-sepia-50 rounded-lg font-medium hover:bg-sepia-900 transition-colors">
                Upload Another Batch
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Pinch to Zoom Modal */}
      {viewingImage && (
        <ImageZoomModal
          url={viewingImage.previewUrl}
          alt={viewingImage.title}
          onClose={() => setViewingImage(null)}
        />
      )}
    </div>
  );
}
