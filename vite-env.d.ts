/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ELEVEN_LABS_API_KEY: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  