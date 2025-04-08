import React, { useState, useEffect, useCallback } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import toast from 'react-hot-toast';
import { InvestmentPlan } from './types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: InvestmentPlan | null;
  onConfirm: () => Promise<string | null>;
}

export function PaymentModal({ isOpen, onClose, plan, onConfirm }: PaymentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setUploadProgress(0);
      setErrorMessage(null);
      setPreview(null);
    }
  }, [isOpen]);

  const validateAndSetFile = (selectedFile: File) => {
    const fileType = selectedFile.type;
    const fileSize = selectedFile.size;
    const maxSize = 5 * 1024 * 1024; // 5MB

    setErrorMessage(null);

    // Validate file type - only allow images
    if (!fileType.startsWith('image/')) {
      toast.error('Please upload only image files (JPG or PNG)');
      return;
    }

    // Validate file size
    if (fileSize > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.onerror = () => {
      toast.error('Failed to generate preview');
    };
    reader.readAsDataURL(selectedFile);

    toast.success('Image selected successfully');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    validateAndSetFile(files[0]);
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
  };

  // Handle drag and drop functionality
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    validateAndSetFile(files[0]);
  }, []);

  const handleUpload = async () => {
    if (!file || !profile?.id) {
      toast.error('Please select a file first');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const investmentId = await onConfirm();
      if (!investmentId) throw new Error('Failed to create investment record');
      setUploadProgress(25);

      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `payment-proofs/${timestamp}_${profile.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(fileName, file);
      if (uploadError) throw uploadError;
      setUploadProgress(50);

      const { error: proofError } = await supabase.from('payment_proofs').insert({
        investment_id: investmentId,
        user_id: profile.id,
        file_path: fileName,
        file_type: file.type,
        status: 'pending'
      });
      if (proofError) {
        await supabase.storage.from('payment-proofs').remove([fileName]);
        throw proofError;
      }
      setUploadProgress(75);

      const { error: investmentError } = await supabase.from('investments').update({ status: 'pending_approval' }).eq('id', investmentId);
      if (investmentError) throw investmentError;
      setUploadProgress(100);
      toast.success('Payment proof uploaded successfully');
      setTimeout(() => onClose(), 1000);
    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage(error.message || 'Failed to upload payment proof');
      toast.error(error.message || 'Failed to upload payment proof');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md relative">
        <button
          onClick={uploading ? undefined : onClose}
          className={`absolute top-4 right-4 text-gray-400 ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:text-white'}`}
          disabled={uploading}
        >
          <X size={20} />
        </button>
        
        <h3 className="text-xl font-bold mb-6">Complete Your Investment</h3>
        
        <div className="space-y-6">
          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Investment Amount</span>
              <span className="font-bold">₹{plan.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Monthly Returns</span>
              <span className="text-emerald-400">₹{plan.monthlyROI.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors
                ${file ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-700 hover:border-gray-600'}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="proof-upload"
                disabled={uploading}
              />
              <label
                htmlFor="proof-upload"
                className="cursor-pointer block"
              >
                {preview ? (
                  <div className="space-y-2">
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="w-40 h-40 mx-auto object-cover rounded-lg"
                    />
                    <p className="text-sm text-gray-400">Click to select a different file</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload size={48} className="mx-auto text-gray-400" />
                    <p className="text-gray-400">
                      Upload your payment proof<br />
                      <span className="text-sm">Click to browse files or drag and drop</span>
                    </p>
                  </div>
                )}
              </label>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-center text-gray-400">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload Proof
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}