// Auth Response
export interface AuthResponse {
    token: string;
    refreshToken: string;
    user: User;
}

export interface User {
    id?: string;
    name: string;
    email: string;
    userName?: string;
    role?: string;
}

// Auth Requests
export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    role?: string;
}

export interface UpdateProfileRequest {
    name: string;
    email: string;
}

export interface UpdateRoleRequest {
    role: string;
}

export interface RefreshRequest {
    token: string;
    refreshToken: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface ResetPasswordRequest {
    email: string;
    newPassword: string;
}

export interface UpdateRoleRequest {
    role: string;
}

export interface ResetPasswordRequest {
    email: string;
    newPassword: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface RefreshRequest {
    token: string;
    refreshToken: string;
}