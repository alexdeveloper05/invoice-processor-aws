import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getRuntimeConfig } from "./config";

export type Session = {
  idToken: string;
  accessToken: string;
};

export async function login(email: string, password: string): Promise<Session> {
  const config = await getRuntimeConfig();
  const client = new CognitoIdentityProviderClient({ region: config.awsRegion });

  const result = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.cognitoClientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })
  );

  const idToken = result.AuthenticationResult?.IdToken;
  const accessToken = result.AuthenticationResult?.AccessToken;
  if (!idToken || !accessToken) {
    throw new Error("Login failed");
  }

  return { idToken, accessToken };
}
