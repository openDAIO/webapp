/// <reference types="vite/client" />

declare module 'virtual:reviewer-character-assets' {
  export const reviewerImageFiles: string[];
  export const reviewerStateFiles: string[];
}

declare namespace NodeJS {
  interface ProcessEnv {
    GEMINI_API_KEY?: string;
    WALLET_CONNECT_PROJECT_ID?: string;
  }
}
