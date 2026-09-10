"""Stocks Tool for JARVIS."""
from __future__ import annotations

import re
from typing import Any

from ._base import JarvisTool, ToolResult

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    yf = None  # type: ignore


class StocksTool(JarvisTool):
    """Tool to retrieve current stock price and basic market information."""

    name: str = "stock_price"
    description: str = "Get current stock price and basic info"
    tags: list[str] = [
        "stock",
        "price",
        "ticker",
        "market",
        "share",
        "invest",
        "finance",
        "nasdaq",
        "nyse",
    ]

    def _extract_ticker(self, ticker: str, query: str) -> str:
        if ticker.strip():
            return ticker.strip().upper()

        query = query.strip()
        if not query:
            return ""

        # Remove common extraneous words like 'price', 'stock', 'quote', 'share'
        # Check for words matching ticker format (1-5 alphabetical characters, optionally with . or -)
        tokens = re.findall(r"\b[A-Za-z]{1,5}\b", query)
        ignore_words = {"PRICE", "STOCK", "STOCKS", "QUOTE", "SHARE", "SHARES", "FOR", "OF", "THE", "CURRENT", "WHAT", "IS"}
        valid_tokens = [t.upper() for t in tokens if t.upper() not in ignore_words]

        if valid_tokens:
            return valid_tokens[0]

        return query.split()[0].upper()

    def run(self, ticker: str = "", query: str = "", **kwargs: Any) -> ToolResult:
        if not YFINANCE_AVAILABLE:
            return ToolResult(
                success=False,
                output="",
                error="yfinance is not installed. Install it via 'pip install yfinance'.",
                tool_name=self.name,
            )

        extracted_ticker = self._extract_ticker(ticker=ticker, query=query)
        if not extracted_ticker:
            return ToolResult(
                success=False,
                output="",
                error="No valid stock ticker or query provided.",
                tool_name=self.name,
            )

        try:
            stock = yf.Ticker(extracted_ticker)
            info = stock.info or {}

            # Retrieve price from info or history fallback
            current_price = (
                info.get("currentPrice")
                or info.get("regularMarketPrice")
                or info.get("previousClose")
            )
            currency = info.get("currency", "USD")
            market_cap = info.get("marketCap", "N/A")
            sector = info.get("sector", "N/A")
            description = info.get("longBusinessSummary") or info.get("description") or "No description available."
            short_desc = description[:300] + ("..." if len(description) > 300 else "")

            # Fetch 5-day history
            history = stock.history(period="5d")

            history_lines: list[str] = []
            if not history.empty:
                if current_price is None and "Close" in history:
                    current_price = history["Close"].iloc[-1]
                for date, row in history.iterrows():
                    date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10]
                    close_val = row.get("Close", 0.0)
                    volume_val = int(row.get("Volume", 0)) if "Volume" in row else 0
                    history_lines.append(f"  {date_str}: Close {close_val:.2f} {currency} (Vol: {volume_val:,})")
            else:
                history_lines.append("  No recent 5-day historical data available.")

            if current_price is None and history.empty:
                return ToolResult(
                    success=False,
                    output="",
                    error=f"Could not retrieve stock data for ticker '{extracted_ticker}'. Please verify the symbol.",
                    tool_name=self.name,
                )

            formatted_price = f"{current_price:.2f} {currency}" if isinstance(current_price, (int, float)) else str(current_price)
            formatted_market_cap = f"{market_cap:,}" if isinstance(market_cap, (int, float)) else str(market_cap)

            output_lines = [
                f"Ticker: {extracted_ticker}",
                f"Current Price: {formatted_price}",
                f"Market Cap: {formatted_market_cap}",
                f"Sector: {sector}",
                f"Summary: {short_desc}",
                "5-Day History:",
                *history_lines,
            ]

            return ToolResult(
                success=True,
                output="\n".join(output_lines),
                tool_name=self.name,
            )
        except Exception as exc:
            return ToolResult(
                success=False,
                output="",
                error=f"Error retrieving data for ticker '{extracted_ticker}': {str(exc)}",
                tool_name=self.name,
            )
