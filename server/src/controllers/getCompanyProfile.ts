import { type Request, type Response } from "express";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";

interface CompanyProfileResponse {
  country: string;
  currency: string;
  estimateCurrency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOUtstanding: number;
  ticker: string;
  weburl: string;
}

const getCompanyProfile = async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol || typeof symbol !== "string" || symbol.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Stock symbol is required",
      });
    }

    const apiKey = process.env.FINHUB_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "API configuration error",
      });
    }

    const config = {
      method: "GET",
      headers: {
        "X-Finnhub-Token": apiKey,
      },
    };

    const finhubResponse = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol.toUpperCase()}`,
      config
    );

    if (!finhubResponse.ok) {
      throw new Error(`There was an error while fetching company information: ${finhubResponse.statusText}`);
    }

    const data: CompanyProfileResponse = await finhubResponse.json();

    console.log(
      `${getCurrentTimestamp()} ✅ - getCompanyProfile - Company information for ${symbol.toUpperCase()} successfully retrieved!`
    );

    res.status(200).json({
      success: true,
      data: {
        symbol: data.ticker,
        name: data.name,
        country: data.country,
        currency: data.currency,
        exchange: data.exchange,
        industry: data.finnhubIndustry,
        ipo: data.ipo,
        marketCapitalization: data.marketCapitalization,
        sharesOutstanding: data.shareOUtstanding,
        logo: data.logo,
        phone: data.phone,
        weburl: data.weburl,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `${getCurrentTimestamp()} ❌ - getCompanyProfile - There was a problem when calling Finnhub API:`,
      errorMessage
    );

    res.status(500).json({
      success: false,
      error: "Failed to fetch company information",
      message: errorMessage,
    });
  }
};

export default getCompanyProfile;
