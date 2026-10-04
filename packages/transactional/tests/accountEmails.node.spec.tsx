import test from 'node:test';
import { createElement } from 'react';
import AccountDeleteConfirmationEmailTemplate from '../emails/Account/delete-confirmation';
import EmailVerifyEmailTemplate from '../emails/Account/email-verify';
import AccountInvitationEmailTemplate from '../emails/Account/invitation';
import ResetPasswordEmailTemplate from '../emails/Account/reset-password';
import WelcomeEmailTemplate from '../emails/Account/welcome';
import { assertHtmlIncludes, renderNonEmpty } from './renderEmail';

test('delete-confirmation renders with the confirmation link', async () => {
    const confirmLink = 'https://example.test/delete-confirmation';
    const html = await renderNonEmpty(
        createElement(AccountDeleteConfirmationEmailTemplate, {
            confirmLink,
            email: 'delete@example.test',
        }),
    );

    assertHtmlIncludes(html, confirmLink);
    assertHtmlIncludes(html, 'delete@example.test');
});

test('email-verify renders with the confirmation link', async () => {
    const confirmLink = 'https://example.test/email-verify';
    const html = await renderNonEmpty(
        createElement(EmailVerifyEmailTemplate, {
            confirmLink,
            email: 'verify@example.test',
        }),
    );

    assertHtmlIncludes(html, confirmLink);
    assertHtmlIncludes(html, 'verify@example.test');
});

test('invitation renders with the accept URL and inviter name', async () => {
    const acceptUrl = 'https://example.test/invitation';
    const invitedByName = 'Marta Test';
    const html = await renderNonEmpty(
        createElement(AccountInvitationEmailTemplate, {
            acceptUrl,
            email: 'invite@example.test',
            invitedByName,
        }),
    );

    assertHtmlIncludes(html, acceptUrl);
    assertHtmlIncludes(html, invitedByName);
});

test('reset-password renders with the confirmation link', async () => {
    const confirmLink = 'https://example.test/reset-password';
    const html = await renderNonEmpty(
        createElement(ResetPasswordEmailTemplate, {
            confirmLink,
            email: 'reset@example.test',
        }),
    );

    assertHtmlIncludes(html, confirmLink);
    assertHtmlIncludes(html, 'reset@example.test');
});

test('welcome renders with the call-to-action URL', async () => {
    const ctaUrl = 'https://example.test/welcome';
    const html = await renderNonEmpty(
        createElement(WelcomeEmailTemplate, {
            ctaUrl,
            email: 'welcome@example.test',
        }),
    );

    assertHtmlIncludes(html, ctaUrl);
    assertHtmlIncludes(html, 'welcome@example.test');
});
