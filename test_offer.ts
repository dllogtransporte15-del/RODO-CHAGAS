import { fetchFreightOffers } from './lib/db';

async function test() {
  const offers = await fetchFreightOffers();
  console.log('Total offers:', offers.length);
}
test();
