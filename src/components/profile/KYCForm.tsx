import React, { useState, useEffect } from 'react';
import { FileText, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import toast from 'react-hot-toast';

interface IdentityProof {
  id: string;
  document_type: 'pan_card' | 'aadhar_card';
  document_number: string;
  file_path: string;
  status: 'pending' | 'verified' | 'rejected';
  admin_notes?: string;
}

export function KYCForm() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<IdentityProof[]>([]);
  const [formData, setFormData] = useState({
    panNumber: '',
    aadharNumber: '',
    panFile: null as File | null,
    aadharFile: null as File | null,
  });

  useEffect(() => {
    fetchDocuments();
  }, [profile?.id]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('identity_proofs')
        .select('*')
        .eq('user_id', profile?.id);

      if (error) throw error;
      
      if (data) {
        setDocuments(data);
        data.forEach(doc => {
          if (doc.document_type === 'pan_card') {
            setFormData(prev => ({ ...prev, panNumber: doc.document_number }));
          } else if (doc.document_type === 'aadhar_card') {
            setFormData(prev => ({ ...prev, aadharNumber: doc.document_number }));
          }
        });
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'pan' | 'aadhar') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF files are allowed');
      return;
    }

    setFormData(prev => ({
      ...prev,
      [type === 'pan' ? 'panFile' : 'aadharFile']: file
    }));

    toast.success(`${type === 'pan' ? 'PAN' : 'Aadhar'} document selected`);
  };

  const uploadDocument = async (file: File, type: 'pan_card' | 'aadhar_card', number: string) => {
    try {
      if (!profile?.id) throw new Error('User not authenticated');

      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `kyc-documents/${profile.id}-${type}-${timestamp}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Create document record
      const { error: docError } = await supabase
        .from('identity_proofs')
        .insert({
          user_id: profile.id,
          document_type: type,
          document_number: number,
          file_path: fileName,
          status: 'pending'
        });

      if (docError) {
        // Cleanup uploaded file if document creation fails
        await supabase.storage.from('kyc-documents').remove([fileName]);
        throw docError;
      }

      return fileName;
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const existingDocs = documents.reduce((acc, doc) => {
        acc[doc.document_type] = doc;
        return acc;
      }, {} as Record<string, IdentityProof>);

      // Validate PAN format
      if (!formData.panNumber.match(/^[A-Z]{5}[0-9]{4}[A-Z]$/)) {
        throw new Error('Invalid PAN number format');
      }

      // Validate Aadhar format (12 digits)
      if (!formData.aadharNumber.match(/^\d{12}$/)) {
        throw new Error('Invalid Aadhar number format');
      }

      if (!existingDocs.pan_card && !formData.panFile) {
        throw new Error('PAN card document is required');
      }

      if (!existingDocs.aadhar_card && !formData.aadharFile) {
        throw new Error('Aadhar card document is required');
      }

      // Upload new documents if provided
      const uploadPromises = [];

      if (formData.panFile) {
        uploadPromises.push(uploadDocument(formData.panFile, 'pan_card', formData.panNumber));
      }

      if (formData.aadharFile) {
        uploadPromises.push(uploadDocument(formData.aadharFile, 'aadhar_card', formData.aadharNumber));
      }

      await Promise.all(uploadPromises);

      toast.success('KYC documents uploaded successfully');
      fetchDocuments();
      
      // Reset file inputs
      setFormData(prev => ({
        ...prev,
        panFile: null,
        aadharFile: null
      }));

      // Reset file input elements
      const panInput = document.getElementById('panFile') as HTMLInputElement;
      const aadharInput = document.getElementById('aadharFile') as HTMLInputElement;
      if (panInput) panInput.value = '';
      if (aadharInput) aadharInput.value = '';

    } catch (error: any) {
      console.error('Error submitting KYC:', error);
      toast.error(error.message || 'Failed to submit KYC documents');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentStatus = (type: 'pan_card' | 'aadhar_card') => {
    return documents.find(doc => doc.document_type === type)?.status || null;
  };

  const renderStatusBadge = (status: string | null) => {
    if (!status) return null;

    const statusConfig = {
      pending: { color: 'text-yellow-400 bg-yellow-400/10', icon: AlertCircle },
      verified: { color: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle2 },
      rejected: { color: 'text-red-400 bg-red-400/10', icon: AlertCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.color} text-sm`}>
        <Icon size={14} />
        <span className="capitalize">{status}</span>
      </div>
    );
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
      <h2 className="text-xl font-bold mb-6">KYC Verification</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PAN Card Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="panNumber" className="block text-sm font-medium text-gray-400">
              PAN Card Number
            </label>
            {renderStatusBadge(getDocumentStatus('pan_card'))}
          </div>
          <input
            id="panNumber"
            type="text"
            value={formData.panNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-2"
            placeholder="Enter PAN number"
            pattern="^[A-Z]{5}[0-9]{4}[A-Z]$"
            title="Please enter a valid PAN number"
            required
            disabled={getDocumentStatus('pan_card') === 'verified'}
          />
          <div className="relative">
            <input
              type="file"
              id="panFile"
              onChange={(e) => handleFileChange(e, 'pan')}
              className="hidden"
             accept="image/*"
              disabled={getDocumentStatus('pan_card') === 'verified'}
            />
            <label
              htmlFor="panFile"
              className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                formData.panFile || getDocumentStatus('pan_card')
                  ? 'border-blue-500/50 bg-blue-500/5'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {formData.panFile ? (
                <div className="flex items-center gap-2 text-blue-400">
                  <FileText size={20} />
                  <span>{formData.panFile.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <Upload size={20} />
                  <span>Select PAN Card File</span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Aadhar Card Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="aadharNumber" className="block text-sm font-medium text-gray-400">
              Aadhar Card Number
            </label>
            {renderStatusBadge(getDocumentStatus('aadhar_card'))}
          </div>
          <input
            id="aadharNumber"
            type="text"
            value={formData.aadharNumber}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 12);
              setFormData(prev => ({ ...prev, aadharNumber: value }));
            }}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-2"
            placeholder="Enter Aadhar number"
            pattern="^\d{12}$"
            title="Please enter a valid 12-digit Aadhar number"
            required
            disabled={getDocumentStatus('aadhar_card') === 'verified'}
            maxLength={12}
          />
          <div className="relative">
            <input
              type="file"
              id="aadharFile"
              onChange={(e) => handleFileChange(e, 'aadhar')}
              className="hidden"
              accept="image/*"
              disabled={getDocumentStatus('aadhar_card') === 'verified'}
            />
            <label
              htmlFor="aadharFile"
              className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                formData.aadharFile || getDocumentStatus('aadhar_card')
                  ? 'border-blue-500/50 bg-blue-500/5'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {formData.aadharFile ? (
                <div className="flex items-center gap-2 text-blue-400">
                  <FileText size={20} />
                  <span>{formData.aadharFile.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <Upload size={20} />
                  <span>Select Aadhar Card File</span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Submit Button */}
        {(!getDocumentStatus('pan_card') || !getDocumentStatus('aadhar_card')) && (
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Uploading...' : 'Submit KYC Documents'}
          </button>
        )}
      </form>
    </div>
  );
}