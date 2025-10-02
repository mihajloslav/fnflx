'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error);
        alert('Greška pri prijavljivanju: ' + error.message);
        router.push('/');
        return;
      }

      if (data.session?.user) {
        const email = data.session.user.email;
        
        // Proveri da li je email sa FON domena
        if (!email?.endsWith('@student.fon.bg.ac.rs')) {
          alert('Samo studenti FON-a mogu da se prijave!');
          await supabase.auth.signOut();
          router.push('/');
          return;
        }
        
        // Preusmeri na glavnu stranicu
        router.push('/');
      } else {
        router.push('/');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Prijavljivanje u toku...</p>
      </div>
    </div>
  );
}
