import { fetchFreightOffers } from './lib/db.ts';

async function test() {
  try {
    const offers = await fetchFreightOffers();
    if (offers.length > 0) {
      console.log('Offer:', JSON.stringify(offers[0], null, 2));
    } else {
      console.log('No offers found to test.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
