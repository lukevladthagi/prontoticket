import { useState, useEffect } from "react";
import type { UserProfile } from "@/shared/types";

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/user-profiles/me", {
        credentials: 'include'
      });
      
      console.log('Profile fetch response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Profile data:', data);
        setProfile(data);
      } else {
        console.error('Failed to fetch profile:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, refreshProfile: fetchProfile };
}
