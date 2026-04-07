import smtplib
from email.message import EmailMessage
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

def send_email_background(action: str, recipient: str, event_title: str, start_time: str, meeting_url: Optional[str] = None):
    """
    Sends an email notification via SMTP.
    Valid actions: 'booked', 'rescheduled', 'cancelled'
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASS:
        logger.warning(f"SMTP not fully configured. Skipping {action} email to {recipient}.")
        return

    msg = EmailMessage()
    msg['From'] = settings.SMTP_FROM or settings.SMTP_USER
    msg['To'] = recipient

    if action == 'booked':
        msg['Subject'] = f"Booking Confirmed: {event_title}"
        body = f"Hello,\n\nYour booking for '{event_title}' has been confirmed for {start_time}.\n"
        if meeting_url:
            body += f"Meeting Link: {meeting_url}\n"
        body += "\nThank you!"
    elif action == 'rescheduled':
        msg['Subject'] = f"Booking Rescheduled: {event_title}"
        body = f"Hello,\n\nYour booking for '{event_title}' has been RESCHEDULED to {start_time}.\n"
        if meeting_url:
            body += f"Meeting Link: {meeting_url}\n"
        body += "\nThank you!"
    elif action == 'cancelled':
        msg['Subject'] = f"Booking Cancelled: {event_title}"
        body = f"Hello,\n\nYour booking for '{event_title}' originally scheduled for {start_time} has been CANCELLED.\n\nThank you!"
    else:
        logger.error(f"Unknown email action: {action}")
        return

    msg.set_content(body)

    try:
        # Use SMTP_SSL if port is 465, else SMTP + starttls
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.send_message(msg)
        server.quit()
        logger.info(f"Successfully sent '{action}' email to {recipient}")
    except Exception as e:
        logger.error(f"Failed to send email to {recipient}: {e}")
