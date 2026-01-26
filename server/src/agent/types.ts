export interface StockPriceData {
  success: boolean;
  data?: {
    symbol: string;
    price: number;
    metadata: {
      high: number;
      low: number;
      open: number;
      previousClose: number;
      change: number;
      changePercent: number;
      timestamp: number;
    };
  };
  error?: string;
}

export interface CompanyProfileData {
  success: boolean;
  data?: {
    symbol: string;
    name: string;
    country: string;
    currency: string;
    exchange: string;
    industry: string;
    ipo: string;
    marketCapitalization: number;
    sharesOutstanding: number;
    logo: string;
    phone: string;
    weburl: string;
  };
  error?: string;
}
