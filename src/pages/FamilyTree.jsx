import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import * as d3 from 'd3';
import { Network, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

export default function FamilyTree() {
    const navigate = useNavigate();
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });

    // Store zoom behavior to allow external control (buttons)
    const zoomBehavior = useRef(null);
    const svgSelection = useRef(null);

    useEffect(() => {
        async function fetchGraphData() {
            try {
                setLoading(true);
                // 1. Fetch all people
                const { data: peopleData, error: peopleError } = await supabase
                    .from('persons')
                    .select('*');

                if (peopleError) throw peopleError;

                // 2. Fetch all relationships
                const { data: relsData, error: relsError } = await supabase
                    .from('person_relationships')
                    .select('*');

                if (relsError) throw relsError;

                // 3. Process into nodes
                const nodes = peopleData.map(p => ({
                    ...p,
                    id: p.id,
                    // Fallback labels
                    label: p.display_name || 'Unknown',
                    birthYear: p.birth_start_date ? p.birth_start_date.substring(0, 4) : '?',
                    deathYear: p.isDeceased ? (p.death_end_date ? p.death_end_date.substring(0, 4) : '?') : ''
                }));

                // 4. Process into directed links
                // The DB has bidirectional edges, so we filter them to prevent drawing double lines.
                // We'll keep A -> B where A < B alphabetically/by UUID to enforce a single physical spring edge per tuple.
                const uniqueLinks = [];
                const seenEdges = new Set();

                relsData.forEach(rel => {
                    // Normalize the edge key so A->B is the same as B->A
                    const [minId, maxId] = [rel.person_a_id, rel.person_b_id].sort();
                    const edgeKey = `${minId}-${maxId}`;

                    if (!seenEdges.has(edgeKey)) {
                        // Determine a summary label for the edge based on the available data type
                        let connectionType = rel.relationship_type.toLowerCase();

                        uniqueLinks.push({
                            source: rel.person_a_id,
                            target: rel.person_b_id,
                            type: connectionType
                        });
                        seenEdges.add(edgeKey);
                    }
                });

                setGraphData({ nodes, links: uniqueLinks });
            } catch (err) {
                console.error("Error loading graph data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchGraphData();
    }, []);

    // Format node display dates
    const formatDates = (node) => {
        const birth = node.birthYear !== '?' ? node.birthYear : '';
        const death = node.isDeceased ? (node.deathYear !== '?' ? node.deathYear : '...') : '';

        if (!birth && !death) return '';
        if (birth && !death) return `b. ${birth}`;
        if (!birth && death) return `d. ${death}`;
        return `${birth} - ${death}`;
    };

    // Rendering the D3 canvas whenever data changes or window resizes
    useEffect(() => {
        if (loading || !svgRef.current || !containerRef.current) return;
        if (graphData.nodes.length === 0) return;

        const containerInfo = containerRef.current.getBoundingClientRect();
        const width = containerInfo.width || 800;
        const height = containerInfo.height || 600;

        // Clear previous renders
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // The main viewport group that takes the transform
        const g = svg.append("g");

        // deep copy so D3 can mutate the graph data arrays without crashing React state rules
        const nodes = graphData.nodes.map(d => ({ ...d }));
        const links = graphData.links.map(d => ({ ...d }));

        // Define simulation physics
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(120))
            .force("charge", d3.forceManyBody().strength(-800))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(60));

        // Handle mapping logic for edges
        const link = g.append("g")
            .attr("stroke", "#c2b092")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", d => d.type === 'spouse' ? 3 : 1.5)
            .attr("stroke-dasharray", d => d.type.includes('step') ? "5,5" : "none");

        // Build functional container nodes
        const node = g.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "cursor-pointer")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("click", (event, d) => {
                // Stop the drag from triggering a click route
                if (event.defaultPrevented) return;
                navigate(`/people/${d.id}`);
            });

        // Build a fast lookup for all connected node pairs to power drag-highlighting
        const linkedByIndex = {};
        links.forEach(d => {
            linkedByIndex[`${d.source.id},${d.target.id}`] = true;
            linkedByIndex[`${d.target.id},${d.source.id}`] = true;
        });

        const isConnected = (a, b) => {
            return linkedByIndex[`${a.id},${b.id}`] || a.id === b.id;
        };

        // Draw the node "Polaroid" ovals
        node.append("ellipse")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("rx", 75)
            .attr("ry", 28)
            .attr("fill", "#fff")
            .attr("stroke", "#d4c5b0")
            .attr("stroke-width", 2)
            .attr("class", "node-shape")
            .style("filter", "drop-shadow(0px 2px 3px rgba(112, 89, 56, 0.2))");

        // Person Name
        node.append("text")
            .text(d => d.label)
            .attr("x", 0)
            .attr("y", -2)
            .attr("text-anchor", "middle")
            .attr("fill", "#4b3b24")
            .attr("font-family", "serif")
            .attr("font-size", "13px")
            .attr("font-weight", "bold");

        // Person Dates
        node.append("text")
            .text(d => formatDates(d))
            .attr("x", 0)
            .attr("y", 14)
            .attr("text-anchor", "middle")
            .attr("fill", "#8c7e6a")
            .attr("font-family", "sans-serif")
            .attr("font-size", "10px");

        // Tick function to update DOM elements per physics frame
        simulation.on("tick", () => {
            // Bounding box constrain mapping could go here if we wanted rigid boundaries, 
            // but infinite zoomable canvas is better.
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Zoom setup
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Initial zoom zoom out a tiny bit to frame
        svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8).translate(-width / 2, -height / 2));

        // Save references for manual buttons
        zoomBehavior.current = zoom;
        svgSelection.current = svg;

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;

            // Highlight connections
            node.selectAll(".node-shape")
                .attr("stroke", o => isConnected(d, o) ? "#d97706" : "#e5e7eb")
                .attr("stroke-width", o => isConnected(d, o) ? 3 : 2);

            link.attr("stroke", o => (o.source.id === d.id || o.target.id === d.id) ? "#d97706" : "#e5e7eb")
                .attr("stroke-opacity", o => (o.source.id === d.id || o.target.id === d.id) ? 1 : 0.2);
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;

            // Reset Highlights
            node.selectAll(".node-shape").attr("stroke", "#d4c5b0").attr("stroke-width", 2);
            link.attr("stroke", "#c2b092").attr("stroke-opacity", 0.6);
        }

        return () => {
            simulation.stop();
        };
    }, [graphData, loading, navigate]);

    const handleZoomIn = () => {
        if (svgSelection.current && zoomBehavior.current) {
            svgSelection.current.transition().duration(300).call(zoomBehavior.current.scaleBy, 1.3);
        }
    };

    const handleZoomOut = () => {
        if (svgSelection.current && zoomBehavior.current) {
            svgSelection.current.transition().duration(300).call(zoomBehavior.current.scaleBy, 0.7);
        }
    };

    const handleResetZoom = () => {
        if (containerRef.current && svgSelection.current && zoomBehavior.current) {
            const containerInfo = containerRef.current.getBoundingClientRect();
            const width = containerInfo.width || 800;
            const height = containerInfo.height || 600;
            svgSelection.current.transition().duration(750).call(
                zoomBehavior.current.transform,
                d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8).translate(-width / 2, -height / 2)
            );
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-500">

            <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-serif font-bold tracking-tight text-sepia-900 border-b border-sepia-200 pb-2 inline-flex items-center gap-3">
                        <Network className="text-sepia-600" size={32} />
                        The Family Tree
                    </h2>
                    <p className="text-sepia-600 mt-2 text-sm max-w-2xl">
                        An interactive visualization of all documented biographical links. Drag the background to pan, scroll to zoom, and drag nodes to untangle connections. Click any node to open their full profile.
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-[var(--color-paper)] p-1.5 rounded-lg border border-sepia-200 shadow-sm">
                    <button onClick={handleZoomOut} className="p-2 text-sepia-700 hover:bg-sepia-100 rounded transition-colors" title="Zoom Out">
                        <ZoomOut size={20} />
                    </button>
                    <button onClick={handleResetZoom} className="p-2 text-sepia-700 hover:bg-sepia-100 rounded transition-colors border-x border-sepia-100 mx-1 px-3" title="Reset View">
                        <Maximize size={18} />
                    </button>
                    <button onClick={handleZoomIn} className="p-2 text-sepia-700 hover:bg-sepia-100 rounded transition-colors" title="Zoom In">
                        <ZoomIn size={20} />
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="flex-1 bg-sepia-50/30 rounded-2xl border border-sepia-200 shadow-inner overflow-hidden relative cursor-grab active:cursor-grabbing"
            >
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sepia-800"></div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                        <div className="bg-red-50 text-red-800 p-6 rounded-lg text-center max-w-md shadow-lg border border-red-200">
                            <p className="font-bold mb-2">Failed to load graph database</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    </div>
                )}

                <svg
                    ref={svgRef}
                    className="w-full h-full"
                    style={{ width: '100%', height: '100%', display: 'block' }}
                />

                {!loading && graphData.nodes.length === 0 && !error && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-sepia-400 pointer-events-none">
                        <Network size={48} className="opacity-30 mb-4" />
                        <p className="text-lg font-medium font-serif">The canopy is empty.</p>
                        <p className="text-sm">Add profiles and link them together to watch the tree grow.</p>
                    </div>
                )}
            </div>

        </div>
    );
}
