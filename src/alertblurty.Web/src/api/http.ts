import axios, { AxiosHeaders } from "axios";

import { clearToken, getToken } from "../auth/tokenStore";
import { apiBaseUrl } from "../config";

export const http = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers = AxiosHeaders.from(config.headers);
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken();
    }

    return Promise.reject(error);
  },
);
