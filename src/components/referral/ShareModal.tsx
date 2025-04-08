import React from 'react';
import {
  X,
  MessageCircle,
  Send,
  Facebook,
  Twitter,
  Mail,
  Clipboard,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode: string;
}

export function ShareModal({ isOpen, onClose, referralCode }: ShareModalProps) {
  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`;

  const shareOptions = [
    {
      platform: 'whatsapp',
      icon: MessageCircle,
      label: 'WhatsApp',
      color: 'bg-green-500',
    },
    {
      platform: 'telegram',
      icon: Send,
      label: 'Telegram',
      color: 'bg-blue-400',
    },
    {
      platform: 'facebook',
      icon: Facebook,
      label: 'Facebook',
      color: 'bg-blue-600',
    },
    {
      platform: 'twitter',
      icon: Twitter,
      label: 'Twitter',
      color: 'bg-sky-400',
    },
    {
      platform: 'email',
      icon: Mail,
      label: 'Email',
      color: 'bg-gray-500',
    },
    {
      platform: 'copy',
      icon: Clipboard,
      label: 'Copy Link',
      color: 'bg-gray-700',
    },
  ];

  const handleShare = async (platform: string) => {
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(referralLink);
        toast.success('Referral link copied to clipboard!');
        onClose();
      } catch (err) {
        toast.error('Failed to copy link.');
      }
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ referralCode, platform }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      window.open(data.shareUrl, '_blank');
      onClose();
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to share. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-bold mb-6 text-white">
          Share Your Referral Link
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {shareOptions.map(({ platform, icon: Icon, label, color }) => (
            <button
              key={platform}
              onClick={() => handleShare(platform)}
              className={`${color} p-4 rounded-lg flex items-center justify-center gap-2 text-white hover:opacity-90 transition-opacity`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
