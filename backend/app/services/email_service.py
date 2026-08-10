"""Email delivery service.

Two entry points:

* :func:`send_email_now` — synchronous, returns ``True``/``False``. Use this
  for OTP delivery where the user is waiting on the response.
* :func:`send_email_background` — fire-and-forget wrapper for
  ``BackgroundTasks``. Failures are logged but never bubble up.

Templates are inlined HTML (with a plain-text alternative) so we don't pull
in a templating engine for half-a-dozen mails.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
import time
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)


def _log_console_email(*, subject: str, recipient: str, text_body: str) -> bool:
    logger.warning(
        "Email console fallback active. Subject=%r Recipient=%s Body=%r",
        subject,
        recipient,
        text_body,
    )
    return True


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

_BASE_STYLE = (
    "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
    "color: #18181b; line-height: 1.6; max-width: 520px; margin: 0 auto;"
    "padding: 32px; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px;"
)
_BUTTON_STYLE = (
    "display: inline-block; padding: 11px 20px; background: #18181b;"
    "color: #ffffff !important; text-decoration: none; border-radius: 8px;"
    "font-weight: 500; font-size: 14px; margin-top: 8px;"
)
_CARD_STYLE = (
    "background: #fafafa; border: 1px solid #e4e4e7; border-radius: 10px;"
    "padding: 16px; margin: 20px 0;"
)
_LABEL_STYLE = (
    "margin: 0 0 4px; color: #71717a; font-size: 11px;"
    "letter-spacing: 0.06em; text-transform: uppercase;"
)
_MUTED_LINK_STYLE = "color: #71717a; font-size: 13px;"


def _wrap_html(title: str, inner: str) -> str:
    return f"""\
<!doctype html>
<html><body style="margin:0;background:#fafafa;padding:32px 16px;">
<div style="{_BASE_STYLE}">
  <h2 style="margin:0 0 16px;font-size:17px;font-weight:600;">{escape(title)}</h2>
  {inner}
  <p style="margin:28px 0 0;font-size:12px;color:#a1a1aa;">Sent by Shopper</p>
</div>
</body></html>"""


def _detail_card(rows: list[tuple[str, str]]) -> str:
    inner = f'<div style="{_CARD_STYLE}">'
    for index, (label, value) in enumerate(rows):
        margin_top = "0" if index == 0 else "14px"
        inner += f'<p style="{_LABEL_STYLE}margin-top:{margin_top};">{escape(label)}</p>'
        inner += f'<p style="margin:0;font-weight:500;font-size:14px;">{escape(value)}</p>'
    return inner + "</div>"


def manage_url_for(manage_token: Optional[str]) -> str:
    if not manage_token:
        return ""
    return f"{settings.FRONTEND_URL.rstrip('/')}/manage/{manage_token}"


def _guest_booking_html(
    action: str,
    event_title: str,
    start_time: str,
    meeting_url: Optional[str],
    manage_token: Optional[str] = None,
) -> tuple[str, str]:
    headlines = {
        "booked": ("Your booking is confirmed", "Your meeting has been scheduled."),
        "rescheduled": ("Your booking was rescheduled", "Your meeting has moved to a new time."),
        "cancelled": ("Your booking was cancelled", "Your meeting has been cancelled."),
    }
    title, lead = headlines.get(action, ("Booking update", "There is an update on your booking."))

    inner = f'<p style="margin:0;font-size:14px;color:#3f3f46;">{lead}</p>'
    inner += _detail_card([("Event", event_title), ("When", start_time)])

    if meeting_url and action != "cancelled":
        inner += f'<a href="{escape(meeting_url, quote=True)}" style="{_BUTTON_STYLE}">Join video call</a>'
        inner += (
            f'<p style="{_MUTED_LINK_STYLE}margin:10px 0 0;">'
            f"Or copy this link: {escape(meeting_url)}</p>"
        )

    text_lines = [lead, "", f"Event: {event_title}", f"When:  {start_time}"]
    if meeting_url and action != "cancelled":
        text_lines += ["", f"Join: {meeting_url}"]

    manage_url = manage_url_for(manage_token)
    if manage_url and action != "cancelled":
        inner += (
            f'<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e4e4e7;'
            f'{_MUTED_LINK_STYLE}">Need to change plans? '
            f'<a href="{escape(manage_url, quote=True)}" style="color:#18181b;">'
            f"Reschedule or cancel</a> — no account needed.</p>"
        )
        text_lines += ["", f"Reschedule or cancel: {manage_url}"]

    if action == "cancelled":
        inner += (
            '<p style="margin:16px 0 0;font-size:13px;color:#71717a;">'
            "If this was unexpected, please reach out to the organiser.</p>"
        )

    return _wrap_html(title, inner), "\n".join(text_lines)


def _host_booking_html(
    action: str,
    event_title: str,
    start_time: str,
    meeting_url: Optional[str],
    guest_name: str,
    guest_email: str,
) -> tuple[str, str]:
    headlines = {
        "host_notified": ("New booking", f"{guest_name or 'Someone'} booked a meeting with you."),
        "host_cancelled_by_guest": (
            "Booking cancelled by guest",
            f"{guest_name or 'Your guest'} cancelled their meeting.",
        ),
        "host_rescheduled_by_guest": (
            "Booking rescheduled by guest",
            f"{guest_name or 'Your guest'} moved their meeting to a new time.",
        ),
    }
    title, lead = headlines.get(action, ("Booking update", "There is an update on a booking."))

    rows = [("Event", event_title), ("When", start_time)]
    if guest_name:
        rows.append(("Guest", guest_name))
    if guest_email:
        rows.append(("Email", guest_email))

    inner = f'<p style="margin:0;font-size:14px;color:#3f3f46;">{escape(lead)}</p>'
    inner += _detail_card(rows)

    if meeting_url and action != "host_cancelled_by_guest":
        inner += f'<a href="{escape(meeting_url, quote=True)}" style="{_BUTTON_STYLE}">Join video call</a>'

    text_lines = [lead, "", f"Event: {event_title}", f"When:  {start_time}"]
    if guest_name:
        text_lines.append(f"Guest: {guest_name} <{guest_email}>")
    if meeting_url and action != "host_cancelled_by_guest":
        text_lines += ["", f"Join: {meeting_url}"]
    return _wrap_html(title, inner), "\n".join(text_lines)


def _otp_html(code: str, ttl_minutes: int) -> tuple[str, str]:
    inner = (
        '<p style="margin:0;font-size:14px;color:#3f3f46;">'
        "Use this code to verify your email and finish booking your meeting.</p>"
        f'<div style="{_CARD_STYLE}text-align:center;">'
        f'<p style="{_LABEL_STYLE}">Verification code</p>'
        f'<p style="margin:0;font-size:32px;letter-spacing:8px;font-weight:600;">{escape(code)}</p>'
        "</div>"
        '<p style="margin:0;color:#71717a;font-size:13px;">'
        f"This code expires in {ttl_minutes} minute(s). "
        "If you didn't request it, you can ignore this email.</p>"
    )
    text = (
        f"Your Shopper verification code is: {code}\n"
        f"It expires in {ttl_minutes} minute(s).\n"
    )
    return _wrap_html("Verify your email", inner), text


# ---------------------------------------------------------------------------
# Transport
# ---------------------------------------------------------------------------

def _build_message(
    *,
    subject: str,
    recipient: str,
    html_body: str,
    text_body: str,
) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    from_addr = settings.SMTP_FROM or settings.SMTP_USER
    msg["From"] = formataddr((settings.SMTP_FROM_NAME, from_addr))
    msg["To"] = recipient
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    return msg


def _deliver(msg: EmailMessage) -> None:
    """Single SMTP delivery attempt. Raises on failure."""
    context = ssl.create_default_context()
    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            context=context,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        ) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
    else:
        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        ) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)


def _send_with_retry(msg: EmailMessage) -> bool:
    """Returns True if delivered, False otherwise. Never raises."""
    attempts = max(1, settings.SMTP_RETRY_COUNT + 1)
    for attempt in range(1, attempts + 1):
        try:
            _deliver(msg)
            logger.info("Email delivered to %s (attempt %d)", msg["To"], attempt)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Email delivery to %s failed on attempt %d/%d: %s",
                msg["To"], attempt, attempts, exc,
            )
            if attempt < attempts:
                time.sleep(2)
    logger.error("Email delivery to %s permanently failed", msg["To"])
    return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_email_now(
    *,
    subject: str,
    recipient: str,
    html_body: str,
    text_body: str,
) -> bool:
    """Synchronous send. Returns True on success, False otherwise."""
    if settings.email_delivery_mode == "console":
        return _log_console_email(subject=subject, recipient=recipient, text_body=text_body)
    if settings.email_delivery_mode == "disabled":
        logger.warning("Email delivery disabled; refusing to send '%s' to %s", subject, recipient)
        return False
    msg = _build_message(
        subject=subject, recipient=recipient, html_body=html_body, text_body=text_body
    )
    return _send_with_retry(msg)


def send_email_background(
    action: str,
    recipient: str,
    event_title: str,
    start_time: str,
    meeting_url: Optional[str] = None,
) -> None:
    """Fire-and-forget booking lifecycle email.

    Designed for use with FastAPI's ``BackgroundTasks``. Never raises.
    """
    if settings.email_delivery_mode == "console":
        subject_map = {
            "booked": f"Booking confirmed: {event_title}",
            "rescheduled": f"Booking rescheduled: {event_title}",
            "cancelled": f"Booking cancelled: {event_title}",
        }
        subject = subject_map.get(action, f"Booking update: {event_title}")
        _log_console_email(
            subject=subject,
            recipient=recipient,
            text_body=f"{action}\nEvent: {event_title}\nWhen: {start_time}\nMeeting URL: {meeting_url or 'n/a'}",
        )
        return
    if settings.email_delivery_mode == "disabled":
        logger.warning("Email delivery disabled; skipping '%s' email to %s", action, recipient)
        return

    subject_map = {
        "booked": f"Booking confirmed: {event_title}",
        "rescheduled": f"Booking rescheduled: {event_title}",
        "cancelled": f"Booking cancelled: {event_title}",
    }
    subject = subject_map.get(action)
    if not subject:
        logger.error("Unknown booking email action: %s", action)
        return

    html_body, text_body = _booking_html(action, event_title, start_time, meeting_url)
    msg = _build_message(
        subject=subject, recipient=recipient, html_body=html_body, text_body=text_body
    )
    _send_with_retry(msg)


def send_otp_email(recipient: str, code: str, ttl_seconds: int) -> bool:
    """Synchronous OTP delivery. Returns True on success, False otherwise."""
    ttl_minutes = max(1, ttl_seconds // 60)
    html_body, text_body = _otp_html(code, ttl_minutes)
    return send_email_now(
        subject="Your verification code",
        recipient=recipient,
        html_body=html_body,
        text_body=text_body,
    )
