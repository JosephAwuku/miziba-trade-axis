/**
 * Account activation email — layout adapted from React Email’s Community template
 * “AWS Verify Email” (verification / activation credential pattern).
 *
 * @see https://react.email/ Templates → Magic Links → AWS Email Verification
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';

export interface TradeAxisAccountActivationEmailProps {
  recipientName: string;
  loginEmail: string;
  temporaryPassword: string;
  roleLabel: string;
  orgName: string;
  loginUrl: string;
}

export default function TradeAxisAccountActivationEmail({
  recipientName,
  loginEmail,
  temporaryPassword,
  roleLabel,
  orgName,
  loginUrl,
}: TradeAxisAccountActivationEmailProps) {
  const previewText = `Your TradeAxis account is ready — sign in now to get started.`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Brand wordmark */}
          <Text style={brandmark}>TradeAxis</Text>

          <Heading style={h1}>Your account is ready</Heading>
          <Text style={text}>Hi {recipientName},</Text>
          <Text style={text}>
            TradeAxis has created your account for <strong>{orgName}</strong>. Your role is{' '}
            <strong>{roleLabel}</strong>.
          </Text>
          <Text style={text}>
            Use the temporary password below to sign in. You will be asked to set a permanent password and
            enable two-factor authentication before you can access the platform — this takes under two minutes.
          </Text>

          <Section style={codeCardOuter}>
            <Section style={codeCardInner}>
              <Text style={codeLabel}>Temporary Password</Text>
              <Text style={codeValue}>{temporaryPassword}</Text>
            </Section>
          </Section>

          <Text style={text}>
            <strong>Your login email:</strong>{' '}
            <Link href={`mailto:${loginEmail}`} style={linkMono}>
              {loginEmail}
            </Link>
          </Text>

          <Section style={ctaSection}>
            <Button href={loginUrl} style={button}>
              Sign in to TradeAxis →
            </Button>
          </Section>

          <Text style={footer}>
            This password is single-use. TradeAxis will never ask you for your password by email or phone.
            If you were not expecting this account, please ignore this message — no action is needed.
          </Text>

          <Hr style={hr} />

          <Text style={footerMuted}>
            © TradeAxis · Miziba Trade Finance Platform ·{' '}
            <Link href={loginUrl} style={link}>
              Open app
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

TradeAxisAccountActivationEmail.PreviewProps = {
  recipientName: 'Jane Doe',
  loginEmail: 'jane@example.com',
  temporaryPassword: 'Welcome123!',
  roleLabel: 'Trader',
  orgName: 'Example Co',
  loginUrl: 'https://example.com',
} satisfies TradeAxisAccountActivationEmailProps;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 24px 48px',
  marginBottom: '64px',
  maxWidth: '560px',
  borderRadius: '8px',
};

const brandmark = {
  color: '#8b0000',
  fontSize: '15px',
  fontWeight: '800',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  margin: '0 0 24px',
};

const h1 = {
  color: '#111827',
  fontSize: '22px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 20px',
};

const text = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
};

/** Gradient frame — mirrors globals `.metric` / `.card` border treatment */
const codeCardOuter = {
  margin: '24px 0',
  padding: '2px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #8b0000 0%, #7c3aed 100%)',
  boxShadow:
    '0 4px 12px rgba(139, 0, 0, 0.06), 0 2px 8px rgba(13, 31, 60, 0.06)',
};

const codeCardInner = {
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  padding: '24px',
  textAlign: 'center' as const,
};

const codeLabel = {
  color: 'rgba(13, 31, 60, 0.72)',
  fontSize: '12px',
  fontWeight: '800',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  margin: '0 0 12px',
};

const codeValue = {
  color: '#18181b',
  fontSize: '24px',
  fontWeight: '700',
  letterSpacing: '0.06em',
  margin: '0',
  fontFamily: 'Menlo, Monaco, Consolas, monospace',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '28px 0',
};

const button = {
  backgroundColor: '#8b0000',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 28px',
};

const link = {
  color: '#8b0000',
};

const linkMono = {
  ...link,
  fontFamily: 'Menlo, Monaco, Consolas, monospace',
  fontSize: '15px',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '16px 0 0',
};

const footerMuted = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '8px 0 0',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '24px 0',
};
