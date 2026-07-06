'use client';
export default function MediaTab({ settings, setSettings }) {
  return (
    <div className="space-y-5 animate-fadeIn">
      <h2 className="text-lg font-semibold text-gray-800">Media Library</h2>
      <p className="text-sm text-gray-500">Upload and manage images/documents for your interactive buttons and replies. (Feature coming soon)</p>
      
      <div className="h-64 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50">
         <span className="text-gray-400 font-medium">Drag & Drop files here (Integration Pending)</span>
      </div>
    </div>
  );
}

