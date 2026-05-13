declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    SQL_CONNECTION_STRING?: string;
    SQL_SERVER?: string;
    SQL_DATABASE?: string;
    SQL_USER?: string;
    SQL_PASSWORD?: string;
    SQL_PORT?: string;
    SQL_TRUST_CERT?: string;
    JWT_SECRET?: string;
    APPLICATIONINSIGHTS_CONNECTION_STRING?: string;
    ALLOWED_ORIGINS?: string;
    APP_VERSION?: string;
  }
}
