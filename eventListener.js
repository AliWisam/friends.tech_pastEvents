/** @format */

const express = require("express");
const Web3 = require("web3");
const contractData = require("./FriendtechSharesV1.json");

const app = express();
const port = 3000;

// Initialize web3
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    "https://base-goerli.g.alchemy.com/v2/OL-2D1YVwyTsAyyr5e2dvCAcPQI1fhw1"
  )
);

const contractAddress = "0x8920df4215934e5f6c8935f0049e9b9d8ddf3656";
const contract = new web3.eth.Contract(contractData.abi, contractAddress);

// Wallet address for which we need to calculate
const walletAddress = "0x5F185Da55f7BBD9217E3b3CeE06b180721FA6d34";

// Contract creation block number
const contractCreationBlock = 10651693;

app.get("/getTradeData", async (req, res) => {
  try {
    const latestBlock = await web3.eth.getBlockNumber();
    let allEvents = [];
    let startBlock = contractCreationBlock;
    let endBlock = startBlock + 2000;

    while (startBlock <= latestBlock) {
      const events = await contract.getPastEvents("Trade", {
        filter: { subject: walletAddress },
        fromBlock: startBlock,
        toBlock: Math.min(endBlock, latestBlock),
      });

      allEvents = allEvents.concat(events);
      startBlock = endBlock + 1;
      endBlock = startBlock + 2000;
    }

    const filteredEvents = allEvents.filter(
      (event) =>
        event.returnValues.subject === walletAddress &&
        Number(event.returnValues.shareAmount) > 0
    );

    let dataForGraph = {};

    for (const event of filteredEvents) {
      const block = await web3.eth.getBlock(event.blockNumber);
      const timeStamp = block.timestamp;

      const ethAmount = Number(event.returnValues.ethAmount) / 1e18;
      const shareAmount = Number(event.returnValues.shareAmount);
      const volume = ethAmount;
      const price = ethAmount / shareAmount;

      const hour = Math.floor(timeStamp / 3600) * 3600;

      if (!dataForGraph[hour]) {
        dataForGraph[hour] = { totalVolume: 0, totalPrice: 0, count: 0 };
      }

      dataForGraph[hour].totalVolume += volume;
      dataForGraph[hour].totalPrice += price;
      dataForGraph[hour].count++;
    }

    const result = Object.keys(dataForGraph).map((hour) => {
      const data = dataForGraph[hour];
      return {
        timeStamp: hour,
        avgPrice: data.totalPrice / data.count,
        volume: data.totalVolume,
      };
    });
    result.sort((a, b) => a.timeStamp - b.timeStamp);
    res.json(result);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
