export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  COMPLIANCE = 'COMPLIANCE',
  TREASURY = 'TREASURY',
  SYSTEM = 'SYSTEM',
}

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublic {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: Role;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  sessionId: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  sessionId: string;
}
