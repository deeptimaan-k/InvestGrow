import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ShareRequest {
  referralCode: string;
  platform?: 'whatsapp' | 'telegram' | 'facebook' | 'twitter' | 'email';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { referralCode, platform } = await req.json() as ShareRequest;

    if (!referralCode) {
      return new Response(
        JSON.stringify({ error: 'Referral code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173';
    const shareUrl = `${baseUrl}/signup?ref=${referralCode}`;
    
    let shareLink = shareUrl;

    // Generate platform-specific share links
    switch (platform) {
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodeURIComponent(`Join our investment platform and earn great returns! Sign up using my referral link: ${shareUrl}`)}`;
        break;
      case 'telegram':
        shareLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join our investment platform and earn great returns! Sign up using my referral link')}`;
        break;
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join our investment platform and earn great returns! Sign up using my referral link: ${shareUrl}`)}`;
        break;
      case 'email':
        shareLink = `mailto:?subject=${encodeURIComponent('Join our Investment Platform')}&body=${encodeURIComponent(`Join our investment platform and earn great returns! Sign up using my referral link: ${shareUrl}`)}`;
        break;
    }

    return new Response(
      JSON.stringify({ shareUrl: shareLink }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});