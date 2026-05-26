export interface ITokenStore {
  storeRefreshToken(userId: string, jti: string, ttlSeconds: number): Promise<void>;
  hasRefreshToken(userId: string, jti: string): Promise<boolean>;
  revokeRefreshToken(userId: string, jti: string): Promise<void>;
  revokeAllRefreshTokens(userId: string): Promise<void>;
  denyAccessToken(jti: string, ttlSeconds: number): Promise<void>;
  isAccessTokenDenied(jti: string): Promise<boolean>;
}
