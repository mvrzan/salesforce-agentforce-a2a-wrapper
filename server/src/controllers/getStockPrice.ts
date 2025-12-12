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
    const apiKey = process.env.FINHUB_API_KEY;

    if (!apiKey) {
      throw new Error("No Alpha Vantage API key!");
    }

    const config = {
      method: "GET",
      headers: {
        "X-Finnhub-Token": apiKey,
      },
    };

    const finhubResponse = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL`, config);

    if (!finhubResponse.ok) {
      throw new Error(`There was an error while fetching stock information: ${finhubResponse.statusText}`);
    }

    const data: StockPriceResponse = await finhubResponse.json();

    const stockPrice = data.c;

    console.log(`${getCurrentTimestamp()} ✅ - getStockPrice - Stock price successfully retrieved!`);

    res.status(200).json({ stockPrice });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `${getCurrentTimestamp()} ❌ - getStockPrice - There was a problem when calling Alpha Vantage API:`,
      errorMessage
    );

    res.status(500).json({
      message: errorMessage,
    });
  }
};

export default getStockPrice;
