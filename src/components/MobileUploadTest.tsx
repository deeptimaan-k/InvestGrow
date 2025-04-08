import React, { useState, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle, Image as ImageIcon, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface DebugLog {
  timestamp: string;
  message: string;
  data?: any;
  success: boolean;
}

interface TestUpload {
  id: string;
  file_path: string;
  file_type: string;
  file_size: number;
  upload_source: string;
  created_at: string;
}

export function MobileUploadTest() {
  const [file, setFile] = useState<File | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [uploads, setUploads] = useState<TestUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('test_uploads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setUploads(data || []);
      addDebugLog('Fetched recent uploads', { count: data?.length });
    } catch (error: any) {
      addDebugLog('Failed to fetch uploads', { error: error.message }, false);
    } finally {
      setRefreshing(false);
    }
  };

  const addDebugLog = (message: string, data?: any, success = true) => {
    const timestamp = new Date().toISOString();
    setDebugLogs(prev => [{
      timestamp,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined,
      success
    }, ...prev]);

    toast(message, {
      icon: success ? '✅' : '❌',
      duration: 4000
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      addDebugLog('No file selected', null, false);
      return;
    }

    const selectedFile = files[0];
    addDebugLog('File selected', {
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size
    });

    if (!['image/jpeg', 'image/png'].includes(selectedFile.type)) {
      addDebugLog('Invalid file type', { type: selectedFile.type }, false);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      addDebugLog('File too large', { size: selectedFile.size }, false);
      return;
    }

    // Create preview for images
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      addDebugLog('Preview generated');
    };
    reader.onerror = () => {
      addDebugLog('Failed to generate preview', reader.error, false);
    };
    reader.readAsDataURL(selectedFile);

    setFile(selectedFile);
    setUploadProgress(0);
    addDebugLog('File validation passed');
  };

  const handleUpload = async () => {
    if (!file) {
      addDebugLog('No file selected', null, false);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    addDebugLog('Starting upload process');

    try {
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `test-uploads/${timestamp}.${fileExt}`;

      addDebugLog('Uploading to storage', { fileName });
      setUploadProgress(20);

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('test-uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;
      setUploadProgress(60);
      addDebugLog('Upload successful', uploadData);

      // Record in database
      const { error: dbError } = await supabase
        .from('test_uploads')
        .insert({
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          upload_source: 'mobile_test'
        });

      if (dbError) {
        // If database insert fails, cleanup the uploaded file
        await supabase.storage.from('test-uploads').remove([fileName]);
        throw dbError;
      }

      setUploadProgress(100);
      addDebugLog('Upload recorded in database');
      
      // Reset form and refresh uploads list
      setFile(null);
      setPreview(null);
      setUploadProgress(0);
      await fetchUploads();

      toast.success('Upload completed successfully!');
    } catch (error: any) {
      addDebugLog('Upload failed', { error: error.message }, false);
      toast.error(`Upload failed: ${error.message}`);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const viewUpload = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('test-uploads')
        .createSignedUrl(filePath, 300);

      if (error) throw error;
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error: any) {
      toast.error('Failed to view file');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Mobile Upload Test</h1>
          <p className="text-gray-400">Test file uploads from mobile devices</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          {/* File Input - Removed capture attribute */}
          <div className="space-y-4">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="block text-center cursor-pointer"
            >
              {preview ? (
                <img src={preview} alt="Preview" className="rounded-lg w-40 h-40 mx-auto object-cover" />
              ) : (
                <div className="w-40 h-40 mx-auto border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center">
                  <Upload className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <p className="mt-2 text-gray-400">Tap to select an image file</p>
            </label>

            {file && (
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-400">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
                {uploadProgress > 0 && (
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={20} />
                      Upload File
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Uploads */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Uploads</h2>
            <button
              onClick={fetchUploads}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="space-y-3">
            {uploads.map(upload => (
              <div
                key={upload.id}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-600 rounded-lg">
                    <ImageIcon size={20} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">
                      {upload.file_path.split('/').pop()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(upload.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => viewUpload(upload.file_path)}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-500"
                >
                  View
                </button>
              </div>
            ))}
            {uploads.length === 0 && (
              <p className="text-center text-gray-400 py-4">No uploads yet</p>
            )}
          </div>
        </div>

        {/* Debug Logs */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Debug Logs</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {debugLogs.map((log, index) => (
              <div key={index} className="p-3 bg-gray-700 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-1">
                  {log.success ? (
                    <CheckCircle size={16} className="text-green-400" />
                  ) : (
                    <AlertCircle size={16} className="text-red-400" />
                  )}
                  <span className="text-blue-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className={log.success ? 'text-green-400' : 'text-red-400'}>{log.message}</p>
                {log.data && (
                  <pre className="mt-2 bg-gray-800 p-2 rounded text-gray-300 overflow-x-auto text-xs">
                    {log.data}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}