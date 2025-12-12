import { type Request, type Response } from "express";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";

interface StockPriceResponse {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

const getStockPrice = async (req: Request, res: Response) => {
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

    const finnhubResponse = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}`, config);

    if (!finnhubResponse.ok) {
      throw new Error(`There was an error while fetching stock information: ${finnhubResponse.statusText}`);
    }

    const data: StockPriceResponse = await finnhubResponse.json();

    const stockPrice = data.c;

    console.log(
      `${getCurrentTimestamp()} ✅ - getStockPrice - Stock price for ${symbol.toUpperCase()} successfully retrieved!`
    );

    res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        price: stockPrice,
        metadata: {
          high: data.h,
          low: data.l,
          open: data.o,
          previousClose: data.pc,
          change: data.d,
          changePercent: data.dp,
          timestamp: data.t,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `${getCurrentTimestamp()} ❌ - getStockPrice - There was a problem when calling Finnhub API:`,
      errorMessage
    );

    res.status(500).json({
      success: false,
      error: "Failed to fetch stock price",
      message: errorMessage,
    });
  }
};

export default getStockPrice;
