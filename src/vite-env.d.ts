/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_USER_POOL_ID: string
  readonly VITE_COGNITO_CLIENT_ID: string
  readonly VITE_COGNITO_REGION: string
  readonly VITE_COACHAI_AGENT_ARN: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_VERSION: string
  readonly HEALTHMATE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}