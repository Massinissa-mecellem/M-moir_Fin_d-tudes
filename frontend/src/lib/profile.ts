import type { AuthMeUser } from "@/features/parcelles/api";

export const isProfileComplete = (user: AuthMeUser | null | undefined): boolean => {
  if (!user || !user.wilaya || !String(user.wilaya).trim()) return false;
  
  if (user.role === 'conseiller') {
    return Boolean(user.telephone && user.specialites && user.specialites.length > 0);
  }
  
  return true; // Pour agriculteur, wilaya suffit selon la logique actuelle
};
