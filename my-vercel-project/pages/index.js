// filepath: /Users/ntianueastmond-visani/my-vercel-project/pages/index.js
import { useEffect } from 'react';
import Airtable from 'airtable';

export default function Home() {
  useEffect(() => {
    console.log("useEffect hook executed");

    require("dotenv").config();
    console.log("dotenv config loaded");

    const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const TABLE_NAME = process.env.TABLE_NAME;

    console.log("Environment Variables:");
    console.log("AIRTABLE_API_TOKEN:", AIRTABLE_API_TOKEN);
    console.log("AIRTABLE_BASE_ID:", AIRTABLE_BASE_ID);
    console.log("TABLE_NAME:", TABLE_NAME);

    if (!AIRTABLE_API_TOKEN || !AIRTABLE_BASE_ID || !TABLE_NAME) {
      console.error("Missing Airtable environment variables");
      return;
    }

    console.log("Connecting to Airtable with the following details:");
    console.log("AIRTABLE_API_TOKEN:", AIRTABLE_API_TOKEN);
    console.log("AIRTABLE_BASE_ID:", AIRTABLE_BASE_ID);
    console.log("TABLE_NAME:", TABLE_NAME);

    const base = new Airtable({ apiKey: AIRTABLE_API_TOKEN }).base(AIRTABLE_BASE_ID);

    base(TABLE_NAME)
      .select({ maxRecords: 5 })
      .eachPage((records, fetchNextPage) => {
        console.log("Fetched records:", records);
        records.forEach(record => {
          console.log(record.fields); // Display the fetched data
        });
        fetchNextPage();
      }, (err) => {
        if (err) {
          console.error("Error fetching records:", err);
        }
      });
  }, []);

  return <h1>Hello, Next.js!</h1>;
}

