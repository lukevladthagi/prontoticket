"use client";

import { useState, useEffect } from 'react';
import { useUserProfile } from './useUserProfile';

type Permissions = Record<string, boolean>;

export function usePermissions() {
  const { profile } = useUserProfile();
  const [permissions, setPermissions] = useState<Permissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    fetch('/api/permissions/me', {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        setPermissions(data.permissions || {});
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading permissions:', err);
        setLoading(false);
      });
  }, [profile]);

  const can = (permission: string): boolean => {
    // Admin always has access to everything
    if (profile?.perfil === 'admin') return true;
    if (permissions['*'] === true) return true;
    
    // Check the permission
    return permissions[permission] === true;
  };

  return { permissions, can, loading };
}
