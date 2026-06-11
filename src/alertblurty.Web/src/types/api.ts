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

export enum ScheduleFrequency {
  Hourly = 0,
  Daily = 1,
  Weekly = 2,
  Monthly = 3,
}

export enum ShiftSwapRequestStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Applied = 3,
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

export interface SetupStatusResponse {
  isConfigured: boolean;
  databaseConfigured: boolean;
  databaseReachable: boolean;
  twilioConfigured: boolean;
  jwtConfigured: boolean;
  hasOrganizations: boolean;
}

export interface DatabaseBootstrapOptions {
  server: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
}

export interface TwilioBootstrapOptions {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export interface BootstrapSetupRequest {
  database: DatabaseBootstrapOptions;
  twilio: TwilioBootstrapOptions;
  jwtSecret?: string;
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

export interface OnCallScheduleDto extends BaseDto {
  teamId: string;
  name: string;
  frequency: ScheduleFrequency;
  startTimeUtc: string;
  durationMinutes: number;
  isActive: boolean;
  teamName?: string;
}

export interface CreateScheduleRequest {
  teamId: string;
  name: string;
  frequency: ScheduleFrequency;
  startTimeUtc: string;
  durationMinutes: number;
}

export interface GenerateShiftsRequest {
  count: number;
}

export interface OnCallShiftDto extends BaseDto {
  scheduleId: string;
  userId: string;
  startTimeUtc: string;
  endTimeUtc: string;
  isSwapped: boolean;
  swappedWithUserId?: string;
  approvedByUserId?: string;
  hasPendingSwapRequest: boolean;
  pendingSwapRequestId?: string;
  pendingSwapTargetUserId?: string;
  userFullName?: string;
  swappedWithUserFullName?: string;
  approvedByUserFullName?: string;
  pendingSwapTargetUserFullName?: string;
  scheduleName?: string;
}

export interface CreateSwapRequest {
  targetUserId: string;
  requesterNote: string;
}

export interface DecideSwapRequest {
  decisionNote: string;
}

export interface ShiftSwapRequestDto extends BaseDto {
  shiftId: string;
  scheduleId: string;
  teamId: string;
  requestedByUserId: string;
  targetUserId: string;
  status: ShiftSwapRequestStatus;
  requiresApprovalSnapshot: boolean;
  requestedAtUtc: string;
  decidedAtUtc?: string;
  decidedByUserId?: string;
  requesterNote: string;
  decisionNote: string;
  requestedByUserFullName?: string;
  targetUserFullName?: string;
  decidedByUserFullName?: string;
  shiftStartTimeUtc: string;
  shiftEndTimeUtc: string;
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
