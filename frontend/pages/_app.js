import { SessionProvider } from "next-auth/react";
// Agar tumhari CSS ka rasta alag hai toh usko apne hisaab se theek kar lena
import "../styles/globals.css"; 

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}

