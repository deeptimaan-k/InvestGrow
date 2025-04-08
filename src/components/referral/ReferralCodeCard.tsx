import React, { useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ShareModal } from './ShareModal';

interface ReferralCodeCardProps {
  referralCode: string;
}

export function ReferralCodeCard({ referralCode }: ReferralCodeCardProps) {
  const [copyAnimation, setCopyAnimation] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleCopyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopyAnimation(true);
      setTimeout(() => setCopyAnimation(false), 1000);
      toast.success('Referral code copied!');
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-300">
      <h2 className="text-xl font-bold mb-4">Your Referral Code</h2>
      <div className="flex gap-4">
        <div className="flex-1 bg-gray-700/30 rounded-lg p-4 font-mono text-lg">
          {referralCode || 'Loading...'}
        </div>
        <button
          onClick={handleCopyReferralCode}
          className={`p-4 bg-blue-600 rounded-lg hover:bg-blue-700 transition-all ${
            copyAnimation ? 'scale-95' : ''
          }`}
        >
          <Copy size={20} />
        </button>
      </div>
      <button
        onClick={() => setIsShareModalOpen(true)}
        className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
      >
        <Share2 size={18} />
        Share Invite Link
      </button>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        referralCode={referralCode}
      />
    </div>
  );
}