import axios, { AxiosInstance } from 'axios'

interface AuthResponse {
    access_token: string
    token_type: string
    scope: string
    expires_in: number
}

class NuvemFiscalClient {
    private api: AxiosInstance
    private authApi: AxiosInstance

    private accessToken: string | null = null
    private expiresAt: number | null = null

    constructor() {
        this.api = axios.create({
            baseURL: 'https://api.nuvemfiscal.com.br',
        })

        this.authApi = axios.create({
            baseURL: 'https://auth.nuvemfiscal.com.br',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })

        // Interceptor para injetar Bearer automaticamente
        this.api.interceptors.request.use(async (config) => {
            if (!this.accessToken || this.isTokenExpired()) {
                await this.authenticate()
            }

            config.headers.Authorization = `Bearer ${this.accessToken}`
            return config
        })
    }

    // 🔐 Autenticação Client Credentials
    private async authenticate() {
        console.log(process.env.NUVEM_FISCAL_CLIENT_ID, process.env.NUVEM_FISCAL_CLIENT_SECRET )
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.NUVEM_FISCAL_CLIENT_ID!,
            client_secret: process.env.NUVEM_FISCAL_CLIENT_SECRET!,
            scope: process.env.NUVEM_FISCAL_SCOPE || 'cep cnpj nfse cte mdfe empresa',
        })

        const response = await this.authApi.post<AuthResponse>(
            '/oauth/token',
            body.toString()
        )

        this.accessToken = response.data.access_token
        this.expiresAt = Date.now() + response.data.expires_in * 1000
    }

    private isTokenExpired() {
        if (!this.expiresAt) return true
        return Date.now() >= this.expiresAt
    }

    // Métodos públicos

    async get<T = any>(url: string, config = {}) {
        return this.api.get<T>(url, config)
    }

    async post<T = any>(url: string, data: any, config = {}) {
        return this.api.post<T>(url, data, config)
    }

    async put<T = any>(url: string, data: any, config = {}) {
        return this.api.put<T>(url, data, config)
    }

    async delete<T = any>(url: string, config = {}) {
        return this.api.delete<T>(url, config)
    }
}

export const nuvemFiscal = new NuvemFiscalClient()
