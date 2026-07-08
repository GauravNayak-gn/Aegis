import NextAuth from "next-auth";
import { authOptions } from "../../../../lib/auth";

// Force rebuild to pick up callback updates
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
