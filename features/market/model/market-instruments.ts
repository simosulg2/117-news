export type MarketInstrument = Readonly<{
  id: string;
  name: string;
  investingUrl: string;
  xetraSymbol: string;
  usSymbol: string;
  isin: string;
  /** Number of Xetra-listed shares represented by one U.S. quote unit. */
  usUnits: number;
}>;

type InstrumentTuple = readonly [
  id: string,
  name: string,
  investingUrl: string,
  xetraSymbol: string,
  usSymbol: string,
  isin: string,
  usUnits?: number,
];

const tuples: readonly InstrumentTuple[] = [
  ["abbott", "Abbott Labs", "https://www.investing.com/equities/abbott-laboratories?cid=963489", "ABL.DE", "ABT", "US0028241000"],
  ["alibaba", "Alibaba ADR", "https://www.investing.com/equities/alibaba?cid=1056243", "AHLA.DE", "BABA", "US01609W1027"],
  ["alphabet", "Alphabet C", "https://www.investing.com/equities/google-inc-c?cid=963657", "ABEC.DE", "GOOG", "US02079K1079"],
  ["amazon", "Amazon.com", "https://www.investing.com/equities/amazon-com-inc?cid=29501", "AMZ.DE", "AMZN", "US0231351067"],
  ["amd", "AMD", "https://www.investing.com/equities/adv-micro-device?cid=963497", "AMD.DE", "AMD", "US0079031078"],
  ["apple", "Apple", "https://www.investing.com/equities/apple-computer-inc?cid=963008", "APC.DE", "AAPL", "US0378331005"],
  ["bank-of-america", "Bank of America", "https://www.investing.com/equities/bank-of-america?cid=29392", "NCB.DE", "BAC", "US0605051046"],
  ["berkshire", "Berkshire Hathaway B", "https://www.investing.com/equities/berkshire-hathaway?cid=963557", "BRYN.DE", "BRK-B", "US0846707026"],
  ["broadcom", "Broadcom", "https://www.investing.com/equities/avago-technologies?cid=1214352", "1YD.DE", "AVGO", "US11135F1012"],
  ["chevron", "Chevron", "https://www.investing.com/equities/chevron?cid=29389", "CHV.DE", "CVX", "US1667641005"],
  ["cisco", "Cisco", "https://www.investing.com/equities/cisco-sys-inc?cid=29409", "CIS.DE", "CSCO", "US17275R1023"],
  ["coca-cola", "Coca-Cola", "https://www.investing.com/equities/coca-cola-co?cid=963231", "CCC3.DE", "KO", "US1912161007"],
  ["eli-lilly", "Eli Lilly", "https://www.investing.com/equities/eli-lilly-and-co?cid=963233", "LLY.DE", "LLY", "US5324571083"],
  ["exxon", "Exxon Mobil", "https://www.investing.com/equities/exxon-mobil?cid=29535", "7DZ.DE", "XOM", "US30233Q1085"],
  ["ge", "GE Aerospace", "https://www.investing.com/equities/general-electric?cid=29561", "GCP.DE", "GE", "US3696043013"],
  ["goldman", "Goldman Sachs", "https://www.investing.com/equities/goldman-sachs-group?cid=29411", "GOS.DE", "GS", "US38141G1040"],
  ["home-depot", "Home Depot", "https://www.investing.com/equities/home-depot?cid=29546", "HDI.DE", "HD", "US4370761029"],
  ["hsbc", "HSBC", "https://www.investing.com/equities/hsbc-holdings?cid=963239", "HBC1.DE", "HSBC", "GB0005405286", 5],
  ["ibm", "IBM", "https://www.investing.com/equities/ibm?cid=29548", "IBM.DE", "IBM", "US4592001014"],
  ["intel", "Intel", "https://www.investing.com/equities/intel-corp?cid=29397", "INL.DE", "INTC", "US4581401001"],
  ["jnj", "J&J", "https://www.investing.com/equities/johnson-johnson?cid=29557", "JNJ.DE", "JNJ", "US4781601046"],
  ["jpmorgan", "JPMorgan", "https://www.investing.com/equities/jp-morgan-chase?cid=29412", "CMC.DE", "JPM", "US46625H1005"],
  ["mastercard", "Mastercard", "https://www.investing.com/equities/mastercard-cl-a?cid=963449", "M4I.DE", "MA", "US57636Q1040"],
  ["mcdonalds", "McDonald’s", "https://www.investing.com/equities/mcdonalds?cid=29415", "MDO.DE", "MCD", "US5801351017"],
  ["merck", "Merck&Co", "https://www.investing.com/equities/merck---co?cid=29416", "6MK.DE", "MRK", "US58933Y1055"],
  ["meta", "Meta Platforms", "https://www.investing.com/equities/facebook-inc?cid=32429", "FB2A.DE", "META", "US30303M1027"],
  ["microsoft", "Microsoft", "https://www.investing.com/equities/microsoft-corp?cid=29399", "MSF.DE", "MSFT", "US5949181045"],
  ["morgan-stanley", "Morgan Stanley", "https://www.investing.com/equities/morgan-stanley?cid=963473", "DWD.DE", "MS", "US6174464486"],
  ["netflix", "Netflix", "https://www.investing.com/equities/netflix,-inc.?cid=963537", "NFC.DE", "NFLX", "US64110L1061"],
  ["nike", "Nike", "https://www.investing.com/equities/nike?cid=29577", "NKE.DE", "NKE", "US6541061031"],
  ["novo-nordisk", "Novo Nordisk B", "https://www.investing.com/equities/novo-nordisk?cid=963357", "NOV.DE", "NVO", "DK0062498333"],
  ["nvidia", "NVIDIA", "https://www.investing.com/equities/nvidia-corp?cid=1056282", "NVD.DE", "NVDA", "US67066G1040"],
  ["oracle", "Oracle", "https://www.investing.com/equities/oracle-corp?cid=963235", "ORC.DE", "ORCL", "US68389X1054"],
  ["pg", "P&G", "https://www.investing.com/equities/procter-gamble?cid=29578", "PRG.DE", "PG", "US7427181091"],
  ["palantir", "Palantir", "https://www.investing.com/equities/palantir-technologies-inc?cid=1170417", "PTX.DE", "PLTR", "US69608A1088"],
  ["paypal", "PayPal", "https://www.investing.com/equities/paypal-holdings-inc?cid=963685", "2PP.DE", "PYPL", "US70450Y1038"],
  ["pepsico", "PepsiCo", "https://www.investing.com/equities/pepsico?cid=29573", "PEP.DE", "PEP", "US7134481081"],
  ["salesforce", "Salesforce Inc", "https://www.investing.com/equities/salesforce-com?cid=963503", "FOO.DE", "CRM", "US79466L3024"],
  ["sap", "SAP", "https://www.investing.com/equities/sap-ag?cid=23532", "SAP.DE", "SAP", "DE0007164600"],
  ["tesla", "Tesla", "https://www.investing.com/equities/tesla-motors?cid=963569", "TL0.DE", "TSLA", "US88160R1014"],
  ["totalenergies", "TotalEnergies SE", "https://www.investing.com/equities/total?cid=963315", "TOTB.DE", "TTE", "FR0000120271"],
  ["verizon", "Verizon", "https://www.investing.com/equities/verizon-communications?cid=29554", "BAC.DE", "VZ", "US92343V1044"],
  ["visa", "Visa A", "https://www.investing.com/equities/visa-inc?cid=963505", "3V64.DE", "V", "US92826C8394"],
  ["walmart", "Walmart", "https://www.investing.com/equities/wal-mart-stores?cid=29541", "WMT.DE", "WMT", "US9311421039"],
  ["disney", "Walt Disney", "https://www.investing.com/equities/disney?cid=29405", "WDP.DE", "DIS", "US2546871060"],
  ["wells-fargo", "Wells Fargo&Co", "https://www.investing.com/equities/wells-fargo?cid=963467", "NWT.DE", "WFC", "US9497461015"],
];

export const MARKET_INSTRUMENTS: readonly MarketInstrument[] = tuples.map(
  ([id, name, investingUrl, xetraSymbol, usSymbol, isin, usUnits = 1]) => ({
    id,
    name,
    investingUrl,
    xetraSymbol,
    usSymbol,
    isin,
    usUnits,
  }),
);
