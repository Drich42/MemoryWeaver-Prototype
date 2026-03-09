import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { BookOpen, AlertCircle } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;
        // Simple success message for non-email-confirmed auth flows
        alert("Account created successfully!");
      }
      
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] flex items-center justify-center p-4 selection:bg-sepia-200">
      
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sepia-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-gold/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md bg-[var(--color-paper)] rounded-2xl shadow-xl border border-sepia-200 p-8 relative z-10 animate-in slide-in-from-bottom-4 duration-500">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-sepia-800 rounded-2xl flex items-center justify-center text-sepia-50 shadow-lg mb-4 transform -rotate-6">
            <BookOpen size={32} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-sepia-900 tracking-tight text-center">Memory Weaver</h1>
          <p className="text-sm text-sepia-500 mt-2 font-medium italic text-center">
            {isLogin ? "Welcome back to your archives." : "Begin cataloging your history."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 text-red-800 animate-in fade-in">
            <AlertCircle className="flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-sepia-700 uppercase tracking-wider">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-sepia-50 border border-sepia-300 rounded-xl text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 focus:border-transparent transition-all"
              placeholder="archivist@family.com"
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-sepia-700 uppercase tracking-wider">Password</label>
            </div>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-sepia-50 border border-sepia-300 rounded-xl text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 bg-sepia-800 hover:bg-sepia-900 text-sepia-50 rounded-xl font-bold text-lg shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-sepia-50 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              isLogin ? 'Unlock Archives' : 'Create Library'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-sepia-100 text-center">
          <p className="text-sm text-sepia-600">
            {isLogin ? "Don't have an archive yet? " : "Already tracking your history? "}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="font-bold text-sepia-800 hover:text-sepia-600 hover:underline transition-colors"
            >
              {isLogin ? "Sign up here." : "Log in here."}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
