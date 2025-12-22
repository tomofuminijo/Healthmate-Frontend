export interface AuthSession {
  userId: string;
  username: string;
  email: string;
  jwtToken: string;        // 短期間有効（通常1時間）
  refreshToken: string;    // 長期間有効（通常30日）
  tokenExpiry: Date;       // JWT_Tokenの有効期限
  refreshTokenExpiry: Date; // Refresh_Tokenの有効期限
  isActive: boolean;
}

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
}