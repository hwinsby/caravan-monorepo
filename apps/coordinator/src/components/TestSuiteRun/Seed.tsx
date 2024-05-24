import React from "react";
import { TEST_FIXTURES } from "@caravan/bitcoin";
import { Grid } from "@mui/material";
import { COLDCARD } from "@caravan/wallets";

import { KeystoreState } from "reducers/keystoreReducer";

const { bip39Phrase } = TEST_FIXTURES.keys.open_source;

const Seed = ({ keystore }: { keystore?: KeystoreState }) => {
  const renderSeedWord = (word: string, i: number) => {
    return (
      <li key={i}>
        <code>{word}</code>
      </li>
    );
  };

  return (
    <>
      <Grid container>
        <Grid item md={3}>
          <ol>{bip39Phrase.slice(0, 6).map(renderSeedWord)}</ol>
        </Grid>
        <Grid item md={3}>
          <ol start={7}>{bip39Phrase.slice(6, 12).map(renderSeedWord)}</ol>
        </Grid>
        <Grid item md={3}>
          <ol start={13}>{bip39Phrase.slice(12, 18).map(renderSeedWord)}</ol>
        </Grid>
        <Grid item md={3}>
          <ol start={19}>{bip39Phrase.slice(18, 24).map(renderSeedWord)}</ol>
        </Grid>
      </Grid>
      {keystore && keystore.type === COLDCARD && (
        <Grid style={{ marginTop: "2em", marginBottom: "2em" }}>
          If using the simulator, here&apos;s a handy command with the same seed
          phrase:
          <br />
          <code>./simulator.py --seed &apos;{bip39Phrase.join(" ")}&apos;</code>
        </Grid>
      )}
    </>
  );
};

export default Seed;
