'use client';

import React, { useState, useEffect, memo, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthUser } from '@/types';
import { Mail, Settings, Check } from 'lucide-react';

interface AuthComponentProps {
  theme: 'light' | 'dark';
}

type AuthStep = 'button' | 'email-form' | 'otp-form' | 'dashboard';

export const AuthComponent: React.FC<AuthComponentProps> = ({ theme }) => {
  const [user, setUser] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [currentStep, setCurrentStep] = useState<AuthStep>('button');
  const [showDashboard, setShowDashboard] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastEmailSent, setLastEmailSent] = useState<number>(0);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Refs for cleanup
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to set success message with auto cleanup
  const setSuccessWithTimeout = useCallback((message: string, timeoutMs = 3000) => {
    // Clear any existing timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    
    setSuccessMessage(message);
    successTimeoutRef.current = setTimeout(() => {
      setSuccessMessage('');
      successTimeoutRef.current = null;
    }, timeoutMs);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Helper function for fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Zahtev je istekao. Molimo pokušajte ponovo.');
      }
      throw error;
    }
  };

  // Global loading state checker - memoized to prevent unnecessary recalculations
  const isAnyLoading = useMemo(() => 
    isSavingUsername || isGeneratingInvite || isLoggingOut || isLoading,
    [isSavingUsername, isGeneratingInvite, isLoggingOut, isLoading]
  );

  useEffect(() => {
    let mounted = true;
    
    // Proveri da li je korisnik već ulogovan
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && mounted) {
          setUser(user);
          setCurrentStep('dashboard');
          
          // Proveri da li korisnik postoji u auth_users tabeli
          const { data: authUserData } = await supabase
            .from('auth_users')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(); // Use maybeSingle instead of single to avoid errors if no user exists
          
          if (authUserData && mounted) {
            setAuthUser(authUserData);
            setTelegramUsername(authUserData.telegram_username || '');
          }
        }
      } catch (error) {
        console.error('Error checking user:', error);
      } finally {
        if (mounted) {
          setIsInitialLoading(false);
        }
      }
    };

    checkUser();

    // Slušaj promene u autentifikaciji
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Auth state change:', event);
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setCurrentStep('dashboard');
          
          // Proveri da li korisnik postoji u bazi
          try {
            const { data: authUserData } = await supabase
              .from('auth_users')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle(); // Use maybeSingle for better performance
            
            if (authUserData && mounted) {
              setAuthUser(authUserData);
              setTelegramUsername(authUserData.telegram_username || '');
            }
          } catch (error) {
            console.error('Error fetching auth user:', error);
          } finally {
            if (mounted) {
              setIsInitialLoading(false);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setAuthUser(null);
          setCurrentStep('button');
          setEmail('');
          setOtp('');
          setTelegramUsername('');
          setIsInitialLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const validateEmail = (email: string): boolean => {
    const regex = /^[a-z]{2}\d{8}@student\.fon\.bg\.ac\.rs$/;
    return regex.test(email);
  };

  const handleEmailSubmit = useCallback(async () => {
    if (isLoading) return;
    const now = Date.now();
    if (now - lastEmailSent < 10000) {
      setError('Molimo sačekajte 10 sekundi pre slanja novog zahteva');
      return;
    }
    setError('');
    if (!email.trim()) {
      setError('Molimo unesite email adresu');
      return;
    }

    if (!validateEmail(email)) {
      setError('Email mora biti u formatu: aa20230101@student.fon.bg.ac.rs');
      return;
    }
    setIsLoading(true);
    setLastEmailSent(now);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
        }
      });
      if (error) {
        if (error.message.includes('rate limit')) {
          setError('Previše pokušaja slanja koda. Pokušajte ponovo za nekoliko minuta.');
        } else if (error.message.includes('email')) {
          setError('Problem sa email adresom. Proverite da li je ispravna.');
        } else {
          setError('Greška pri slanju koda: ' + error.message);
        }
      } else {
        setCurrentStep('otp-form');
      }
    } catch {
      setError('Neočekivana greška');
    } finally {
      setIsLoading(false);
    }
  }, [email, isLoading, lastEmailSent]);

  const handleOtpSubmit = async () => {
    setError('');
    
    if (!otp.trim()) {
      setError('Molimo unesite kod');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'email'
      });

      if (error) {
        setError('Neispravan kod: ' + error.message);
      }
      // Uspeh se automatski handleuje kroz onAuthStateChange
    } catch {
      setError('Neočekivana greška');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTelegramUsername = useCallback(async () => {
    if (!user?.id || !user?.email || !telegramUsername.trim()) {
      setError('Molimo unesite Telegram korisničko ime');
      return;
    }

    // Prevent multiple calls
    if (isSavingUsername) return;

    // Validacija dužine username-a
    const cleanUsername = telegramUsername.trim().replace('@', '');
    if (cleanUsername.length > 32) {
      setError('Telegram username je predugačak (maksimalno 32 karaktera)');
      return;
    }

    if (cleanUsername.length < 5) {
      setError('Telegram username je prekratak (minimalno 5 karaktera)');
      return;
    }

    // Validacija karaktera (samo slova, brojevi i _ )
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      setError('Telegram username može sadržavati samo slova, brojeve i _');
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSavingUsername(true);
    setError('');
    setSuccessMessage('');
    
    try {
      // Koristi upsert za sigurno i brzo čuvanje
      const { data, error } = await supabase
        .from('auth_users')
        .upsert({
          user_id: user.id,
          email: user.email,
          telegram_username: cleanUsername,
        }, {
          onConflict: 'email' // email ima UNIQUE constraint
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase greška:', error);
        throw new Error(error.message);
      }
      
      setAuthUser(data);
      setError('');
      setSuccessWithTimeout('Telegram username je uspešno sačuvan!');
      setIsEditingUsername(false); // Izađi iz edit moda
        
    } catch (error) {
      // Don't show error if request was aborted
      if ((error as Error).name === 'AbortError') return;
      
      console.error('Catch greška:', error);
      setError('Greška pri čuvanju podataka: ' + (error as Error).message);
      setSuccessMessage('');
    } finally {
      setIsSavingUsername(false);
      abortControllerRef.current = null;
    }
  }, [user?.id, user?.email, telegramUsername, isSavingUsername, setSuccessWithTimeout]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return; // Prevent double clicks
    
    try {
      setIsLoggingOut(true);
      setError('');
      setSuccessMessage('');
      
      // Clear timeouts and abort any pending requests
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        throw new Error(error.message);
      }
      
      // Resetuj sva lokalna stanja
      setUser(null);
      setAuthUser(null);
      setCurrentStep('button');
      setShowDashboard(false);
      setIsEditingUsername(false);
      setEmail('');
      setOtp('');
      setTelegramUsername('');
      setError('');
      setSuccessMessage('');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Successfully logged out');
      }
        
    } catch (error) {
      console.error('Logout error:', error);
      setError('Greška pri odjavi: ' + (error as Error).message);
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut]);

  const handleGenerateInviteLink = async () => {
    if (!user?.id || !user?.email) {
      setError('Nedostaju podaci o korisniku');
      return;
    }
    if (isGeneratingInvite) return; 
    setIsGeneratingInvite(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await fetchWithTimeout('/api/telegram-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_invite',
          user_id: user.id,
          email: user.email,
        }),
      }, 30000);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Greška pri generisanju link-a');
      }
      if (data.success && data.invite_link) {
        // Ažuriraj lokalni state sa invite link-om
        setAuthUser(prev => prev ? {
          ...prev,
          invite_link: data.invite_link
        } : null);
        
        setSuccessWithTimeout('Telegram link je kreiran!');
      } else {
        throw new Error('Neispravno odgovor sa servera');
      }
    } catch (error) {
      console.error('Error generating invite link:', error);
      setError('Greška pri kreiranju Telegram link-a: ' + (error as Error).message);
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleJoinTelegramGroup = async (inviteLink: string) => {
    if (!user?.id) return;
    
    setError('');
    setSuccessMessage('');
    
    try {
      // Postavi added = true (invite_link ostaje u bazi)
      const { error } = await supabase
        .from('auth_users')
        .update({ 
          added: true
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating user status:', error);
        throw new Error(error.message);
      }
      
      // Ažuriraj lokalni state
      setAuthUser(prev => prev ? {
        ...prev,
        added: true
        // invite_link ostaje isto
      } : null);
      
      // Otvori Telegram link
      window.open(inviteLink, '_blank');
      
      setSuccessMessage('Uspešno ste označeni kao verifikovani!');
      setTimeout(() => setSuccessMessage(''), 3000);
        
    } catch (error) {
      console.error('Error joining Telegram group:', error);
      setError('Greška pri pridruživanju grupi: ' + (error as Error).message);
    }
  };

  // Initial loading screen
  if (isInitialLoading) {
    return (
      <div
        className="px-8 py-4 rounded-3xl font-medium inline-flex items-center gap-3 w-full max-w-sm lg:w-auto lg:max-w-none justify-center"
        style={{
          background: theme === 'light' 
            ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
            : 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)',
          boxShadow: theme === 'light'
            ? '12px 12px 24px #c5d1dc, -12px -12px 24px #ffffff'
            : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          color: theme === 'light' ? '#004B7C' : '#e2e8f0',
          border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none',
          opacity: 0.8
        }}
      >
        <div 
          className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"
        />
        <span className="text-lg md:text-lg sm:text-base font-semibold">
          Učitavanje...
        </span>
      </div>
    );
  }

  // Dugme (početno stanje ili kada je prijavljen)
  if (currentStep === 'button') {
    return (
      <button
        onClick={() => setCurrentStep('email-form')}
        className="px-8 py-4 rounded-3xl font-medium transition-all duration-300 hover:scale-105 inline-flex items-center gap-3 w-full max-w-sm lg:w-auto lg:max-w-none justify-center"
        style={{
          background: theme === 'light' 
            ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
            : 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)',
          boxShadow: theme === 'light'
            ? '12px 12px 24px #c5d1dc, -12px -12px 24px #ffffff'
            : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          color: theme === 'light' ? '#004B7C' : '#e2e8f0',
          border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none'
        }}
      >
        <Mail size={20} />
        <span className="text-lg md:text-lg sm:text-base font-semibold truncate">
          Prijavi se pomoću studentskog mejla
        </span>
      </button>
    );
  }

  // Kontrolna tabla (kada je prijavljen)
  if (user) {
    return (
      <div>
        <button
          onClick={() => setShowDashboard(true)}
          className="px-8 py-4 rounded-3xl font-medium transition-all duration-300 hover:scale-105 inline-flex items-center gap-3 w-full max-w-sm lg:w-auto lg:max-w-none justify-center"
          style={{
            background: theme === 'light' 
              ? 'linear-gradient(145deg, #5CC2AB, #4a9d89)'
              : 'linear-gradient(145deg, #e50914, #b8070f)',
            boxShadow: theme === 'light'
              ? '12px 12px 24px #c5d1dc, -12px -12px 24px #ffffff'
              : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            color: 'white',
          }}
        >
          <Settings size={20} />
          <span className="text-lg md:text-lg sm:text-base font-semibold truncate">
            Kontrolna tabla
          </span>
        </button>

        {/* Dashboard Modal */}
        {showDashboard && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div 
              className="p-6 rounded-3xl max-w-md w-full relative"
              style={{
                background: theme === 'light' 
                  ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
                  : 'linear-gradient(135deg, rgba(25, 34, 70, 0.9) 0%, rgba(33, 14, 23, 0.9) 100%)',
                boxShadow: theme === 'light'
                  ? '12px 12px 24px #c5d1dc, -12px -12px 24px #ffffff'
                  : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none',
              }}
            >
              <h2 
                className="text-xl font-bold mb-4"
                style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
              >
                Kontrolna tabla
              </h2>
              
              <p 
                className="text-sm mb-4"
                style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
              >
                Prijavljen kao: <strong>{user.email}</strong>
              </p>
              
              <div className="mb-4">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
                >
                  Telegram username (bez @):
                </label>
                
                {/* Upozorenje o bot-u */}
                <div 
                  className="mb-3 p-3 rounded-lg text-sm"
                  style={{
                    background: theme === 'light' 
                      ? 'rgba(239, 68, 68, 0.1)' 
                      : 'rgba(239, 68, 68, 0.2)',
                    border: theme === 'light' 
                      ? '1px solid rgba(239, 68, 68, 0.3)' 
                      : '1px solid rgba(239, 68, 68, 0.4)',
                    color: theme === 'light' ? '#dc2626' : '#fca5a5'
                  }}
                >
                  ⚠️ <strong>VAŽNO:</strong> Unesite TAČNO Vaš Telegram username (korisničko ime). 
                  <br />
                  <strong>Username NIJE isto što i ime!</strong> Username na Telegramu počinje sa @ - idite na profil i videćete &quot;Username&quot;.
                  <br /><br />
                  <strong>Bot automatski banuje:</strong>
                  <br />• Korisnike bez Telegram username-a
                  <br />• Korisnike čiji username nije u ovoj bazi podataka
                  <br />• Korisnike čiji username se ne poklapa sa stvarnim Telegram username-om
                </div>
                
                {/* Ako username već postoji u bazi i nije u edit modu */}
                {authUser?.telegram_username && telegramUsername && !isEditingUsername ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={telegramUsername}
                      disabled
                      className="w-full px-4 py-3 rounded-xl border"
                      style={{
                        background: theme === 'light' ? '#f8f9fa' : 'rgba(255, 255, 255, 0.05)',
                        border: theme === 'light' ? '1px solid #e9ecef' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: theme === 'light' ? '#6c757d' : '#9ca3af',
                        cursor: 'not-allowed',
                      }}
                    />
                    
                    {/* Dugmad u novom redu za mobile */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Ako je korisnik verifikovan (added = true), prikaži check mark */}
                      {authUser?.added ? (
                        <div 
                          className="px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                          style={{
                            background: 'linear-gradient(145deg, #10b981, #059669)',
                            color: 'white',
                          }}
                        >
                          <Check size={20} />
                          <span>Verifikovan</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsEditingUsername(true)}
                          className="px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2"
                          style={{
                            background: theme === 'light' 
                              ? 'linear-gradient(145deg, #FFCD67, #e6b84d)'
                              : 'linear-gradient(145deg, #dc143c, #a1102a)',
                            color: theme === 'light' ? '#004B7C' : 'white',
                          }}
                        >
                          Izmeni
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Ako nema username ili je u edit modu */
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="primer: john_doe"
                    className="w-full px-4 py-3 rounded-xl border"
                    style={{
                      background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.1)',
                      border: theme === 'light' ? '1px solid #d1d9e6' : '1px solid rgba(255, 255, 255, 0.2)',
                      color: theme === 'light' ? '#004B7C' : '#e2e8f0',
                    }}
                  />
                )}
                
                {error && (
                  <p className="text-red-500 text-sm mt-2">{error}</p>
                )}
                
                {successMessage && (
                  <p className="text-green-600 text-sm mt-2 font-medium">{successMessage}</p>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                {/* Dugme za čuvanje - prikaži samo ako nema sačuvan username u bazi ili je u edit modu (i nije verifikovan) */}
                {(!authUser?.telegram_username || (isEditingUsername && !authUser?.added)) && (
                  <button
                    onClick={handleSaveTelegramUsername}
                    disabled={isAnyLoading}
                    className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{
                      background: theme === 'light' 
                        ? 'linear-gradient(145deg, #5CC2AB, #4a9d89)'
                        : 'linear-gradient(145deg, #e50914, #b8070f)',
                      color: 'white',
                      opacity: isAnyLoading ? 0.5 : 1,
                    }}
                  >
                    {isSavingUsername ? 'Čuvanje...' : 'Sačuvaj username'}
                  </button>
                )}
                
                {/* Dugme za otkazivanje edit moda - samo za neverifikovane korisnike */}
                {isEditingUsername && !authUser?.added && (
                  <button
                    onClick={() => {
                      setIsEditingUsername(false);
                      // Vrati na originalnu vrednost iz baze
                      setTelegramUsername(authUser?.telegram_username || '');
                      setError('');
                    }}
                    className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{
                      background: theme === 'light' 
                        ? 'linear-gradient(145deg, #f48580, #d66e6a)'
                        : 'linear-gradient(145deg, #dc143c, #a1102a)',
                      color: 'white',
                    }}
                  >
                    Otkaži
                  </button>
                )}
              </div>

              {/* Telegram link dugmad */}
              {authUser?.telegram_username && (
                <div className="mb-4">
                  {!authUser?.added ? (
                    // Za neverifikovane korisnike - dugme za kreiranje/pristup
                    <div className="flex flex-col sm:flex-row gap-3">
                      {!authUser?.invite_link ? (
                        // Dugme za kreiranje invite link-a
                        <button
                          onClick={handleGenerateInviteLink}
                          disabled={isAnyLoading}
                          className="w-full px-4 py-3 rounded-xl font-medium transition-all duration-300"
                          style={{
                            background: theme === 'light' 
                              ? 'linear-gradient(145deg, #3b82f6, #2563eb)'
                              : 'linear-gradient(145deg, #1d4ed8, #1e40af)',
                            color: 'white',
                            opacity: isAnyLoading ? 0.5 : 1,
                          }}
                        >
                          {isGeneratingInvite ? 'Kreira link...' : 'Uzmi Telegram link'}
                        </button>
                      ) : (
                        // Dugme za pristup Telegram grupi
                        <button
                          onClick={() => handleJoinTelegramGroup(authUser.invite_link!)}
                          className="w-full px-4 py-3 rounded-xl font-medium transition-all duration-300"
                          style={{
                            background: 'linear-gradient(145deg, #0088cc, #006699)',
                            color: 'white',
                          }}
                        >
                          Pridruži se Telegram grupi
                        </button>
                      )}
                    </div>
                  ) : (
                    // Za verifikovane korisnike - dugme uvek dostupno
                    authUser?.invite_link && (
                      <div className="w-full">
                        <button
                          onClick={() => window.open(authUser.invite_link!, '_blank')}
                          className="w-full px-4 py-3 rounded-xl font-medium transition-all duration-300"
                          style={{
                            background: 'linear-gradient(145deg, #0088cc, #006699)',
                            color: 'white',
                          }}
                        >
                          Pridruži se Telegram grupi
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Kontrolni dugmad - responzivni layout */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowDashboard(false)}  
                  className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                  style={{
                    background: theme === 'light' 
                      ? 'linear-gradient(145deg, #e2e8f0, #cbd5e0)'
                      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                    color: theme === 'light' ? '#004B7C' : '#e2e8f0',
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                  }}
                >
                  Zatvori
                </button>
                
                <button
                  onClick={handleLogout}
                  disabled={isAnyLoading}
                  className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                  style={{
                    background: theme === 'light' 
                      ? 'linear-gradient(145deg, #f48580, #d66e6a)'
                      : 'linear-gradient(145deg, #dc143c, #a1102a)',
                    color: 'white',
                    opacity: isAnyLoading ? 0.5 : 1,
                  }}
                >
                  {isLoggingOut ? 'Odjavljujem...' : 'Odjavi se'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Modal za forme
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="p-6 rounded-3xl max-w-md w-full relative"
        style={{
          background: theme === 'light' 
            ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
            : 'linear-gradient(135deg, rgba(25, 34, 70, 0.9) 0%, rgba(33, 14, 23, 0.9) 100%)',
          boxShadow: theme === 'light'
            ? '12px 12px 24px #c5d1dc, -12px -12px 24px #ffffff'
            : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
          border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none',
        }}
      >
        {/* Email forma */}
        {currentStep === 'email-form' && (
          <>
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
            >
              Studentski mejl
            </h2>
            
            <p 
              className="text-sm mb-4"
              style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
            >
              Unesite vaš studentski email da biste dobili kod za pristup.
            </p>
            
            <div className="mb-4">
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
              >
                Email adresa:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="aa20230101@student.fon.bg.ac.rs"
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.1)',
                  border: theme === 'light' ? '1px solid #d1d9e6' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: theme === 'light' ? '#004B7C' : '#e2e8f0',
                }}
              />
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCurrentStep('button');
                  setEmail(''); // Obriši email kada se ide nazad
                  setError(''); // Obriši greške
                }}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                style={{
                  background: theme === 'light' 
                    ? 'linear-gradient(145deg, #e2e8f0, #cbd5e0)'
                    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                  color: theme === 'light' ? '#004B7C' : '#e2e8f0',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                }}
              >
                Nazad
              </button>
              
              <button
                onClick={handleEmailSubmit}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                style={{
                  background: theme === 'light' 
                    ? 'linear-gradient(145deg, #5CC2AB, #4a9d89)'
                    : 'linear-gradient(145deg, #e50914, #b8070f)',
                  color: 'white',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {isLoading ? 'Slanje...' : 'Pošalji kod'}
              </button>
            </div>
          </>
        )}

        {/* OTP forma */}
        {currentStep === 'otp-form' && (
          <>
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
            >
              Unesite kod
            </h2>
            
            <p 
              className="text-sm mb-4"
              style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
            >
              Kod je poslat na: <strong>{email}</strong>
            </p>
            
            <div className="mb-4">
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
              >
                6-cifreni kod:
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl border text-center text-xl tracking-widest"
                style={{
                  background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.1)',
                  border: theme === 'light' ? '1px solid #d1d9e6' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: theme === 'light' ? '#004B7C' : '#e2e8f0',
                }}
              />
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCurrentStep('email-form');
                  setOtp(''); // Obriši OTP kada se ide nazad
                  setError(''); // Obriši greške
                }}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                style={{
                  background: theme === 'light' 
                    ? 'linear-gradient(145deg, #e2e8f0, #cbd5e0)'
                    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                  color: theme === 'light' ? '#004B7C' : '#e2e8f0',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                }}
              >
                Nazad
              </button>
              
              <button
                onClick={handleOtpSubmit}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                style={{
                  background: theme === 'light' 
                    ? 'linear-gradient(145deg, #5CC2AB, #4a9d89)'
                    : 'linear-gradient(145deg, #e50914, #b8070f)',
                  color: 'white',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {isLoading ? 'Proverava...' : 'Potvrdi'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(AuthComponent);
