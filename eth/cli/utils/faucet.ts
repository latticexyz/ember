import fetch from "node-fetch";
const FAUCET = "https://latticeprotocol.vercel.app/api/request";

export async function getFund(address: string): Promise<void> {
    let res: string | undefined;
    try {
        const response = await fetch(FAUCET, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ address }),
        });
        res = await response.text();
        if (res.includes("Not enough fund")) {
            throw new Error("No more funds in the faucet.");
        }
    } catch (e) {
        console.error("Error while requesting from faucet " + e + ". res: " + res);
        throw e;
    }
}
