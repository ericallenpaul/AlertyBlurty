export enum UserRole {
  User = 0,
  Admin = 1,
  SuperAdmin = 2,
}

export enum IncidentStatus {
  Open = 0,
  Acknowledged = 1,
  Resolved = 2,
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

interface BaseDto {
  id: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface UserDto extends BaseDto {
  organizationId: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  timezone: string;
  role: UserRole;
  isActive: boolean;
  organizationName?: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  timezone: string;
  organizationName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OrganizationDto extends BaseDto {
  name: string;
  defaultTimezone: string;
  isSetupComplete: boolean;
}

export interface TeamDto extends BaseDto {
  organizationId: string;
  name: string;
  description: string;
  requireAdminApprovalForSwaps: boolean;
  organizationName?: string;
  members?: TeamMemberDto[];
}

export interface CreateTeamRequest {
  name: string;
  description: string;
  requireAdminApprovalForSwaps: boolean;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  requireAdminApprovalForSwaps?: boolean;
}

export interface TeamMemberDto extends BaseDto {
  teamId: string;
  userId: string;
  rotationOrder: number;
  isActive: boolean;
  userFullName?: string;
  userEmail?: string;
  teamName?: string;
}

export interface AddTeamMemberRequest {
  userId: string;
  rotationOrder: number;
}

export interface CreateUserRequest {
  organizationId: string;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  timezone: string;
  role: UserRole;
  isActive: boolean;
}

export interface UpdateUserRequest {
  fullName?: string;
  phoneNumber?: string;
  timezone?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface IncidentDto extends BaseDto {
  teamId: string;
  zabbixEventId: string;
  zabbixTriggerId: string;
  hostName: string;
  triggerName: string;
  triggerDescription: string;
  severity: number;
  firstOccurrenceUtc: string;
  lastOccurrenceUtc: string;
  eventCount: number;
  status: IncidentStatus;
  acknowledgedByUserId?: string;
  acknowledgedAtUtc?: string;
  teamName?: string;
  acknowledgedByUserName?: string;
}
