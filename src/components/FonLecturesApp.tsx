'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronDown, Play, Calendar, Clock, ExternalLink, BookOpen, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { subjects, Year } from '@/utils/subjects';
import { Lecture } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import AuthComponent from '@/components/AuthComponent';

const FonLecturesApp = () => {
  const { theme, toggleTheme, mounted } = useTheme();
  const [selectedYear, setSelectedYear] = useState<Year | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState(new Set<string>());
  const [closingSubjects, setClosingSubjects] = useState(new Set<string>());
  const [lectures, setLectures] = useState<Record<string, Lecture[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [subjectsWithLectures, setSubjectsWithLectures] = useState<Record<number, string[]>>({});
  const [subjectsLoading, setSubjectsLoading] = useState<Record<number, boolean>>({});
  const [subjectCounts, setSubjectCounts] = useState<Record<number, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [subjectLectureCounts, setSubjectLectureCounts] = useState<Record<string, number>>({});

  // Funkcija za pronalaženje predmeta sa snimcima za određenu godinu
  const fetchSubjectsWithLectures = useCallback(async (year: number) => {
    if ((subjectsWithLectures[year] && subjectsWithLectures[year].length > 0) || subjectsLoading[year] || !isSupabaseConfigured) return;

    setSubjectsLoading(prev => ({ ...prev, [year]: true }));

    try {
      const yearSubjects = subjects[year as Year];
      const subjectsWithData: string[] = [];
      const newSubjectCounts: Record<string, number> = {};

      for (const subject of yearSubjects) {
        const { count, error } = await supabase
          .from('lecture')
          .select('*', { count: 'exact', head: true })
          .eq('name', subject);

        if (!error && count && count > 0) {
          subjectsWithData.push(subject);
          newSubjectCounts[subject] = count;
        }
      }

      setSubjectsWithLectures(prev => ({ ...prev, [year]: subjectsWithData }));
      // Postavi broj snimaka za svaki predmet
      setSubjectLectureCounts(prev => ({ ...prev, ...newSubjectCounts }));
    } catch (error) {
      console.error('Error fetching subjects with lectures:', error);
    } finally {
      setSubjectsLoading(prev => ({ ...prev, [year]: false }));
    }
  }, [subjectsWithLectures, subjectsLoading]);

  // Funkcija za učitavanje broja predmeta sa snimcima za sve godine
  const fetchSubjectCounts = async () => {
    if (!isSupabaseConfigured) {
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);

    try {
      const counts: Record<number, number> = {};
      
      // Izvuci sve jedinstvene predmete iz svih godina
      const allSubjects = new Set<string>();
      for (const year of [1, 2, 3, 4] as Year[]) {
        subjects[year].forEach(subject => allSubjects.add(subject));
      }
      
      // Jedan upit za sve predmete odjednom
      const { data, error } = await supabase
        .from('lecture')
        .select('name')
        .in('name', Array.from(allSubjects));

      if (error) {
        console.error('Error fetching subject counts:', error);
        return;
      }

      // Kreiraj set predmeta koji imaju snimke
      const subjectsWithLectures = new Set(data?.map(item => item.name) || []);
      
      // Izračunaj brojeve za svaku godinu
      for (const year of [1, 2, 3, 4] as Year[]) {
        counts[year] = subjects[year].filter(subject => 
          subjectsWithLectures.has(subject)
        ).length;
      }

      setSubjectCounts(counts);
    } catch (error) {
      console.error('Error fetching subject counts:', error);
    } finally {
      setCountsLoading(false);
    }
  };

  // Učitaj predmete sa snimcima kada se selektuje godina
  useEffect(() => {
    if (selectedYear) {
      fetchSubjectsWithLectures(selectedYear);
    }
  }, [selectedYear, fetchSubjectsWithLectures]);

  // Učitaj broj predmeta sa snimcima za sve godine kada se komponenta učita
  useEffect(() => {
    fetchSubjectCounts();
  }, []);

  const fetchLecturesForSubject = async (subject: string) => {
    if (lectures[subject] || loading[subject] || !isSupabaseConfigured) return;

    setLoading(prev => ({ ...prev, [subject]: true }));

    try {
      const { data, error } = await supabase
        .from('lecture')
        .select('*')
        .eq('name', subject)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching lectures:', error);
        return;
      }

      setLectures(prev => ({ ...prev, [subject]: data || [] }));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(prev => ({ ...prev, [subject]: false }));
    }
  };

  const toggleSubjectExpansion = async (subject: string) => {
    const newExpanded = new Set(expandedSubjects);
    if (newExpanded.has(subject)) {
      // Start closing animation
      setClosingSubjects(prev => new Set(prev).add(subject));
      
      // Wait for animation to complete, then remove from expanded
      setTimeout(() => {
        setExpandedSubjects(prev => {
          const updated = new Set(prev);
          updated.delete(subject);
          return updated;
        });
        setClosingSubjects(prev => {
          const updated = new Set(prev);
          updated.delete(subject);
          return updated;
        });
      }, 300); // Match animation duration
    } else {
      newExpanded.add(subject);
      setExpandedSubjects(newExpanded);
      await fetchLecturesForSubject(subject);
    }
  };

  const getLecturesForSubject = (subject: string): Lecture[] => {
    return lectures[subject] || [];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getYearColor = (year: number) => {
    switch(year) {
      case 1: return '#D057A0';
      case 2: return '#5CC2AB';
      case 3: return '#FFCD67';
      case 4: return '#F48580';
      default: return '#004B7C';
    }
  };

  const getNetflixGradient = () => {
    // Glassmorphism gradient sa specifičnim bojama
    return 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)';
  };

  // Ne renderuj komponentu dok se theme ne učita (hydration issue)
  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ 
      background: theme === 'light' 
        ? 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)'
        : 'linear-gradient(135deg, rgb(25, 34, 70) 0%, rgb(33, 14, 23) 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Theme Toggle - Position fixed in top right */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>

      {/* Header */}
      <div className="pt-8 pb-12 text-center">
        {theme === 'dark' ? (
          // Dark theme - logo sa tekstom ispod
          <div className="flex flex-col items-center">
            <Image 
              src="/fonflixlogo.svg" 
              alt="Fonflix Logo" 
              width={225}
              height={75}
              className="object-contain mb-4"
              style={{ marginBottom: '40px', marginTop: '20px' }}
            />
            <p 
              className="text-lg"
              style={{ color: '#e2e8f0' }}
            >
              Snimljena predavanja FON-a
            </p>
          </div>
        ) : (
          // Light theme - logo slika kao u dark theme
          <div className="flex flex-col items-center">
            <Image 
              src="/fonflixlogolight.svg" 
              alt="Fonflix Logo" 
              width={225}
              height={75}
              className="object-contain mb-4"
              style={{ marginBottom: '40px', marginTop: '20px' }}
            />
            <p 
              className="text-lg"
              style={{ color: '#5CC2AB' }}
            >
              Snimljena predavanja FON-a
            </p>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        {/* Upozorenje ako Supabase nije konfigurisan */}
        {!isSupabaseConfigured && (
          <div 
            className="mb-8 p-4 rounded-2xl flex items-center gap-3"
            style={{
              background: theme === 'light' 
                ? 'linear-gradient(145deg, #fef2f2, #fee2e2)'
                : 'linear-gradient(135deg, rgba(153, 27, 27, 0.8) 0%, rgba(127, 29, 29, 0.8) 100%)',
              boxShadow: theme === 'light'
                ? '4px 4px 8px #e5b8b8, -4px -4px 8px #ffffff'
                : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
              backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
              border: theme === 'light' ? '1px solid #fca5a5' : '1px solid rgba(220, 38, 38, 0.5)'
            }}
          >
            <AlertCircle size={24} style={{ color: '#dc2626' }} />
            <div>
              <p className="font-medium" style={{ color: '#dc2626' }}>
                Supabase nije konfigurisan
              </p>
              <p className="text-sm" style={{ color: theme === 'light' ? '#7f1d1d' : '#b3b3b3' }}>
                Dodajte NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY u .env.local fajl da biste učitali predavanja.
              </p>
            </div>
          </div>
        )}

        {!selectedYear ? (
          /* Izbor godine - uvek prikaži sve godine */
          <div>
            {/* Auth dugme - zamenjuje Telegram grupa link */}
            <div className="mb-8 flex justify-center">
              <AuthComponent theme={theme} />
            </div>

            {/* Obaveštenje o potrebi za prijavom */}
            <div 
              className="mb-6 p-4 rounded-2xl text-center"
              style={{
                background: theme === 'light' 
                  ? 'linear-gradient(145deg, #fef3c7, #fde68a)'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)',
                boxShadow: theme === 'light'
                  ? '6px 6px 12px #e5d5a7, -6px -6px 12px #ffffff'
                  : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
                border: theme === 'light' 
                  ? '1px solid rgba(245, 158, 11, 0.3)' 
                  : '1px solid rgba(245, 158, 11, 0.3)'
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle size={20} style={{ color: theme === 'light' ? '#d97706' : '#fbbf24' }} />
                <h3 
                  className="text-base font-semibold"
                  style={{ color: theme === 'light' ? '#d97706' : '#fbbf24' }}
                >
                  Potrebna je prijava
                </h3>
              </div>
              <p 
                className="text-sm"
                style={{ color: theme === 'light' ? '#92400e' : '#fcd34d' }}
              >
                Prijavite se studentskim mejlom da biste videli Telegram linkove za snimke predavanja
              </p>
            </div>

            {/* Onboarding uputstvo */}
            <div 
              className="mb-8 p-6 rounded-3xl"
              style={{
                background: theme === 'light' 
                  ? 'linear-gradient(145deg, #f0f9ff, #e0f2fe)'
                  : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
                boxShadow: theme === 'light'
                  ? '8px 8px 16px #c5d1dc, -8px -8px 16px #ffffff'
                  : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
                border: theme === 'light' 
                  ? '1px solid rgba(59, 130, 246, 0.2)' 
                  : '1px solid rgba(59, 130, 246, 0.3)'
              }}
            >
              <div className="flex items-start gap-4">
                <div 
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1"
                  style={{ 
                    background: theme === 'light' ? '#3b82f6' : 'rgba(59, 130, 246, 0.3)',
                    border: theme === 'dark' ? '1px solid rgba(59, 130, 246, 0.5)' : 'none'
                  }}
                >
                  <span 
                    className="text-sm font-bold"
                    style={{ color: theme === 'light' ? 'white' : '#60a5fa' }}
                  >
                    📚
                  </span>
                </div>
                <div className="flex-1">
                  <h3 
                    className="text-lg font-semibold mb-4"
                    style={{ color: theme === 'light' ? '#1e40af' : '#60a5fa' }}
                  >
                    Uputstvo za pristup snimcima predavanja
                  </h3>
                  
                  {/* Upozorenje o incognito modu */}
                  <div 
                    className="p-3 rounded-lg mb-4"
                    style={{
                      background: theme === 'light' 
                        ? 'rgba(220, 38, 38, 0.1)' 
                        : 'rgba(220, 38, 38, 0.2)',
                      border: theme === 'light' 
                        ? '1px solid rgba(220, 38, 38, 0.3)' 
                        : '1px solid rgba(220, 38, 38, 0.4)',
                    }}
                  >
                    <p className="font-semibold" style={{ color: '#dc2626' }}>
                      ⚠️ VAŽNO: Koristite INCOGNITO MOD (CTRL + SHIFT + N)
                    </p>
                    <p className="text-xs mt-1" style={{ color: theme === 'light' ? '#dc2626' : '#fca5a5' }}>
                      Preporučujemo incognito tab zbog problema sa keširanjem
                    </p>
                  </div>
                  
                  <div 
                    className="text-sm space-y-3 leading-relaxed"
                    style={{ color: theme === 'light' ? '#1e40af' : '#93c5fd' }}
                  >
                    <div>
                      <p className="font-semibold mb-2">Korak 1: Prijava na platformu</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Kliknite na dugme &quot;Prijavi se&quot; iznad</li>
                        <li>Unesite svoj <strong>studentski mejl</strong> (@student.fon.bg.ac.rs)</li>
                        <li>Proverite mejl i unesite 6-cifreni kod koji ste dobili</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold mb-2">Korak 2: Podešavanje Telegram username-a</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Nakon prijave, unesite svoj <strong>tačan Telegram username</strong> (bez @)</li>
                        <li><strong>PAŽNJA:</strong> Morate uneti vaš stvarni Telegram username, ne ime ili nadimak</li>
                        <li>Da proverite username: idite u Telegram → Settings → Username</li>
                        <li>Ako nemate username, prvo ga napravite u Telegram aplikaciji</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold mb-2">Korak 3: Pristup Telegram grupi</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Kliknite na &quot;Uzmi Telegram link&quot; da dobijete invite link</li>
                        <li>Pridružite se grupi koristeći link</li>
                        <li>Bot će vas automatski verifikovati na osnovu username-a</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold mb-2">Korak 4: Gledanje snimaka</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Izaberite godinu studija i predmet</li>
                        <li>Kliknite na Telegram dugme pored predavanja</li>
                        <li>Snimci se nalaze u Telegram grupi kao video fajlovi</li>
                      </ul>
                    </div>

                    <div className="mt-4 p-3 rounded-lg" style={{ 
                      background: theme === 'light' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.2)',
                      border: `1px solid ${theme === 'light' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.4)'}`
                    }}>
                      <p className="font-semibold text-red-600 dark:text-red-400 mb-1">⚠️ Važno upozorenje:</p>
                      <p className="text-red-600 dark:text-red-400 text-xs">
                        Ako ne unesete tačan Telegram username ili ako nemate username, bot će vas automatski izbaciti iz grupe!
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t" style={{ 
                      borderColor: theme === 'light' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)'
                    }}>
                      <p className="font-semibold mb-2">📞 Potrebna pomoć ili uklanjanje sadržaja?</p>
                      <p>
                        Za sva pitanja ili zahteve za uklanjanje sadržaja kontaktirajte:{' '}
                        <a 
                          href="https://t.me/fonflix_support"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline hover:opacity-80 transition-opacity"
                          style={{ color: theme === 'light' ? '#1d4ed8' : '#60a5fa' }}
                        >
                          @fonflix_support
                        </a>
                        {' '}na Telegram-u
                      </p>
                      <p className="text-xs mt-1 opacity-75">
                        (Ne šaljite mejlove - koristimo samo Telegram za podršku)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {([1, 2, 3, 4] as Year[]).map((year) => (
              <div
                key={year}
                onClick={() => setSelectedYear(year)}
                className="p-8 rounded-3xl cursor-pointer transition-all duration-300 hover:scale-105"
                style={{
                  background: theme === 'light' 
                    ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
                    : getNetflixGradient(),
                  boxShadow: theme === 'light'
                    ? '12px 12px 24px #c5d1dc, -12px -12px 24px #ffffff'
                    : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                  backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (theme === 'light') {
                    e.currentTarget.style.boxShadow = 'inset 4px 4px 8px #c5d1dc, inset -4px -4px 8px #ffffff';
                  } else {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(25, 34, 70, 0.9) 0%, rgba(33, 14, 23, 0.9) 100%)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme === 'light') {
                    e.currentTarget.style.boxShadow = '12px 12px 24px #c5d1dc, -12px -12px 24px #ffffff';
                  } else {
                    e.currentTarget.style.background = getNetflixGradient();
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                <div className="text-center">
                  <div 
                    className="text-4xl font-bold mb-4"
                    style={{ color: theme === 'light' ? getYearColor(year) : '#e50914' }}
                  >
                    {year}.
                  </div>
                  <div 
                    className="text-xl font-semibold"
                    style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
                  >
                    GODINA
                  </div>
                  <div 
                    className="text-sm mt-2 flex items-center justify-center"
                    style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
                  >
                    {countsLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}></div>
                    ) : (
                      (() => {
                        const count = subjectCounts[year] !== undefined ? subjectCounts[year] : 0;
                        return `${count} ${count === 1 ? 'predmet' : 'predmeta'}`;
                      })()
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        ) : (
          /* Prikaz predmeta za odabranu godinu */
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 
                className="text-3xl font-bold flex items-center gap-3"
                style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
              >
                <BookOpen size={32} />
                {selectedYear}. godina
              </h2>
              <button
                onClick={() => {
                  setSelectedYear(null);
                  setExpandedSubjects(new Set());
                  setClosingSubjects(new Set());
                  // Uklanjamo brisanje podataka da se sačuvaju u cache-u
                }}
                className="px-6 py-3 rounded-2xl font-medium transition-all duration-300 cursor-pointer hover:scale-110"
                style={{
                  background: theme === 'light'
                    ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
                    : 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)',
                  boxShadow: theme === 'light'
                    ? '6px 6px 12px #c5d1dc, -6px -6px 12px #ffffff'
                    : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                  backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none',
                  color: theme === 'light' ? '#004B7C' : '#e2e8f0',
                  transform: 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  if (theme === 'light') {
                    e.currentTarget.style.boxShadow = 'inset 4px 4px 8px #c5d1dc, inset -4px -4px 8px #ffffff';
                  } else {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(25, 34, 70, 0.9) 0%, rgba(33, 14, 23, 0.9) 100%)';
                  }
                  e.currentTarget.style.transform = 'scale(1.1) translateX(-2px)';
                }}
                onMouseLeave={(e) => {
                  if (theme === 'light') {
                    e.currentTarget.style.boxShadow = '6px 6px 12px #c5d1dc, -6px -6px 12px #ffffff';
                  } else {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)';
                  }
                  e.currentTarget.style.transform = 'scale(1) translateX(0px)';
                }}
              >
                ← Nazad
              </button>
            </div>

            <div className="grid gap-4">
              {subjectsLoading[selectedYear] ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: theme === 'light' ? '#004B7C' : '#e50914' }}></div>
                  <p style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}>Učitavanje predmeta</p>
                </div>
              ) : subjectsWithLectures[selectedYear]?.length > 0 ? (
                subjectsWithLectures[selectedYear].map((subject, index) => {
                  const isExpanded = expandedSubjects.has(subject);
                  const isClosing = closingSubjects.has(subject);
                  const subjectLectures = getLecturesForSubject(subject);
                  const isLoading = loading[subject];
                  const lectureCount = subjectLectureCounts[subject] || 0;
                  const hasLectures = lectureCount > 0;

                  return (
                    <div
                      key={index}
                      className="rounded-3xl overflow-hidden"
                      style={{
                        background: theme === 'light'
                          ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
                          : 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)',
                        boxShadow: theme === 'light'
                          ? '8px 8px 16px #c5d1dc, -8px -8px 16px #ffffff'
                          : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                        backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none'
                      }}
                    >
                      <div
                        onClick={() => toggleSubjectExpansion(subject)}
                        className="p-6 cursor-pointer transition-all duration-300"
                        style={{
                          background: isExpanded 
                            ? theme === 'light'
                              ? 'linear-gradient(145deg, #e2e8f0, #cbd5e0)'
                              : 'linear-gradient(135deg, rgba(25, 34, 70, 0.9) 0%, rgba(33, 14, 23, 0.9) 100%)'
                            : 'transparent'
                        }}
                      >
                        {/* Desktop layout */}
                        <div className="hidden md:flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div 
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: theme === 'light' ? getYearColor(selectedYear) : '#e50914' }}
                            />
                            <span 
                              className="text-lg font-medium flex-1 min-w-0 truncate"
                              style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
                            >
                              {subject}
                            </span>
                            {hasLectures && (
                              <span 
                                className="px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 mr-4"
                                style={{
                                  backgroundColor: theme === 'light' ? '#5CC2AB' : '#e50914',
                                  color: 'white'
                                }}
                              >
                                {lectureCount} {lectureCount === 1 ? 'snimak' : lectureCount <= 4 ? 'snimka' : 'snimaka'}
                              </span>
                            )}
                          </div>
                          <ChevronDown 
                            size={20} 
                            className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                            style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
                          />
                        </div>

                        {/* Mobile layout */}
                        <div className="block md:hidden">
                          {/* Red 1: Dot, naziv predmeta i strelica */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div 
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: theme === 'light' ? getYearColor(selectedYear) : '#e50914' }}
                              />
                              <span 
                                className="text-lg font-medium flex-1 min-w-0"
                                style={{ 
                                  color: theme === 'light' ? '#004B7C' : '#e2e8f0',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {subject}
                              </span>
                            </div>
                            <ChevronDown 
                              size={20} 
                              className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} flex-shrink-0 ml-3`}
                              style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
                            />
                          </div>
                          
                          {/* Red 2: Broj snimaka */}
                          {hasLectures && (
                            <div className="flex justify-start pl-8">
                              <span 
                                className="px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap"
                                style={{
                                  backgroundColor: theme === 'light' ? '#5CC2AB' : '#e50914',
                                  color: 'white'
                                }}
                              >
                                {lectureCount} {lectureCount === 1 ? 'snimak' : lectureCount <= 4 ? 'snimka' : 'snimaka'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {(isExpanded || isClosing) && (
                        <div className={`lectures-container px-6 pb-6 pt-4 ${isClosing ? 'slide-up' : 'slide-down'}`}>
                          {isLoading ? (
                            <div className="text-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: theme === 'light' ? '#004B7C' : '#e50914' }}></div>
                              <p className="mt-4" style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}>Učitavam predavanja...</p>
                            </div>
                          ) : hasLectures ? (
                            <div className="lectures-scrollable space-y-4 mt-2">
                              {subjectLectures.map((lecture, index) => (
                                <div
                                  key={lecture.id}
                                  className="p-5 rounded-2xl transition-all duration-300 cursor-pointer"
                                  style={{
                                    background: theme === 'light'
                                      ? 'linear-gradient(145deg, #ffffff, #f1f5f9)'
                                      : 'linear-gradient(135deg, rgba(25, 34, 70, 0.6) 0%, rgba(33, 14, 23, 0.6) 100%)',
                                    boxShadow: theme === 'light'
                                      ? '4px 4px 8px #c5d1dc, -4px -4px 8px #ffffff'
                                      : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                                    backdropFilter: theme === 'dark' ? 'blur(10px)' : 'none',
                                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none',
                                    animation: `slideInFromTop 0.4s ease-out ${index * 0.1}s both`
                                  }}
                                  onMouseEnter={(e) => {
                                    if (theme === 'light') {
                                      e.currentTarget.style.boxShadow = 'inset 2px 2px 4px #c5d1dc, inset -2px -2px 4px #ffffff';
                                    } else {
                                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(25, 34, 70, 0.7) 0%, rgba(33, 14, 23, 0.7) 100%)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (theme === 'light') {
                                      e.currentTarget.style.boxShadow = '4px 4px 8px #c5d1dc, -4px -4px 8px #ffffff';
                                    } else {
                                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(25, 34, 70, 0.6) 0%, rgba(33, 14, 23, 0.6) 100%)';
                                    }
                                  }}
                                >
                                  {/* Desktop layout - postojeći dizajn */}
                                  <div className="hidden md:block">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <div 
                                          className="px-3 py-1 rounded-full text-sm font-bold"
                                          style={{
                                            border: theme === 'light' ? 'none' : '2px solid #dc2626',
                                            color: theme === 'light' ? 'white' : '#dc2626',
                                            backgroundColor: theme === 'light' 
                                              ? (lecture.type === 'P' ? '#D057A0' : '#F48580')
                                              : 'transparent'
                                          }}
                                        >
                                          {lecture.type}
                                        </div>
                                        <span 
                                          className="font-medium"
                                          style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
                                        >
                                          {lecture.session_name || 'Predavanje'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div 
                                          className="flex items-center gap-2 text-sm"
                                          style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
                                        >
                                          <Clock size={16} />
                                          {lecture.time}
                                        </div>
                                        <div 
                                          className="flex items-center gap-2 text-sm"
                                          style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
                                        >
                                          <Calendar size={16} />
                                          {formatDate(lecture.date)}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-3 mt-4">
                                      {lecture.telegram_url && (
                                        <a
                                          href={lecture.telegram_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105"
                                          style={{
                                            background: theme === 'light' 
                                              ? 'linear-gradient(145deg, #5CC2AB, #4a9d89)'
                                              : 'linear-gradient(145deg, #e50914, #b8070f)',
                                            color: 'white',
                                            boxShadow: theme === 'light'
                                              ? '4px 4px 8px rgba(92, 194, 171, 0.3)'
                                              : '4px 4px 8px rgba(229, 9, 20, 0.3)'
                                          }}
                                        >
                                          <Play size={16} />
                                          Telegram
                                          <ExternalLink size={14} />
                                        </a>
                                      )}
                                      
                                      {lecture.youtube_url && (
                                        <a
                                          href={lecture.youtube_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105"
                                          style={{
                                            background: theme === 'light'
                                              ? 'linear-gradient(145deg, #FFCD67, #e6b84d)'
                                              : 'linear-gradient(145deg, #dc143c, #a1102a)',
                                            color: theme === 'light' ? '#004B7C' : 'white',
                                            boxShadow: theme === 'light'
                                              ? '4px 4px 8px rgba(255, 205, 103, 0.3)'
                                              : '4px 4px 8px rgba(220, 20, 60, 0.3)'
                                          }}
                                        >
                                          <Play size={16} />
                                          YouTube
                                          <ExternalLink size={14} />
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {/* Mobile layout - 4 reda */}
                                  <div className="block md:hidden space-y-3">
                                    {/* Red 1: Tip i naziv termina */}
                                    <div className="flex items-center gap-3">
                                      <div 
                                        className="px-3 py-1 rounded-full text-sm font-bold"
                                        style={{
                                          border: theme === 'light' ? 'none' : '2px solid #dc2626',
                                          color: theme === 'light' ? 'white' : '#dc2626',
                                          backgroundColor: theme === 'light' 
                                            ? (lecture.type === 'P' ? '#D057A0' : '#F48580')
                                            : 'transparent'
                                        }}
                                      >
                                        {lecture.type}
                                      </div>
                                      <span 
                                        className="font-medium text-sm"
                                        style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
                                      >
                                        {lecture.session_name || 'Predavanje'}
                                      </span>
                                    </div>

                                    {/* Red 2: Termin i datum */}
                                    <div className="flex items-center gap-4 text-sm" style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}>
                                      <div className="flex items-center gap-2">
                                        <Clock size={14} />
                                        {lecture.time}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Calendar size={14} />
                                        {formatDate(lecture.date)}
                                      </div>
                                    </div>

                                    {/* Red 3: Telegram dugme */}
                                    {lecture.telegram_url && (
                                      <div>
                                        <a
                                          href={lecture.telegram_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 w-full justify-center"
                                          style={{
                                            background: theme === 'light' 
                                              ? 'linear-gradient(145deg, #5CC2AB, #4a9d89)'
                                              : 'linear-gradient(145deg, #e50914, #b8070f)',
                                            color: 'white',
                                            boxShadow: theme === 'light'
                                              ? '4px 4px 8px rgba(92, 194, 171, 0.3)'
                                              : '4px 4px 8px rgba(229, 9, 20, 0.3)'
                                          }}
                                        >
                                          <Play size={16} />
                                          Telegram
                                          <ExternalLink size={14} />
                                        </a>
                                      </div>
                                    )}

                                    {/* Red 4: YouTube dugme */}
                                    {lecture.youtube_url && (
                                      <div>
                                        <a
                                          href={lecture.youtube_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 w-full justify-center"
                                          style={{
                                            background: theme === 'light'
                                              ? 'linear-gradient(145deg, #FFCD67, #e6b84d)'
                                              : 'linear-gradient(145deg, #dc143c, #a1102a)',
                                            color: theme === 'light' ? '#004B7C' : 'white',
                                            boxShadow: theme === 'light'
                                              ? '4px 4px 8px rgba(255, 205, 103, 0.3)'
                                              : '4px 4px 8px rgba(220, 20, 60, 0.3)'
                                          }}
                                        >
                                          <Play size={16} />
                                          YouTube
                                          <ExternalLink size={14} />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div 
                              className="text-center py-10 mt-4"
                              style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
                            >
                              <Clock size={48} className="mx-auto mb-4 opacity-50" />
                              {!isSupabaseConfigured ? (
                                <>
                                  <p className="text-lg">Supabase nije konfigurisan</p>
                                  <p className="text-sm mt-2">Konfigurišite Supabase da biste videli predavanja</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-lg">Još nema snimljenih predavanja</p>
                                  <p className="text-sm mt-2">Snimci će biti dodati uskoro</p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                /* Nema predmeta sa snimcima za ovu godinu */
                <div 
                  className="text-center py-16 rounded-3xl"
                  style={{
                    background: theme === 'light'
                      ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
                      : 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)',
                    boxShadow: theme === 'light'
                      ? '8px 8px 16px #c5d1dc, -8px -8px 16px #ffffff'
                      : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                    backdropFilter: theme === 'dark' ? 'blur(15px)' : 'none',
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none'
                  }}
                >
                  <Clock size={64} className="mx-auto mb-6 opacity-50" style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }} />
                  <h3 
                    className="text-2xl font-bold mb-4"
                    style={{ color: theme === 'light' ? '#004B7C' : '#e2e8f0' }}
                  >
                    Još nema snimljenih predavanja za {selectedYear}. godinu
                  </h3>
                  <p 
                    className="text-lg mb-2"
                    style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
                  >
                    Snimci će biti dodati uskoro
                  </p>
                  <p 
                    className="text-sm"
                    style={{ color: theme === 'light' ? '#9B95C9' : '#b3b3b3' }}
                  >
                    Ukupno predmeta za ovu godinu: {subjects[selectedYear].length}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FonLecturesApp;
