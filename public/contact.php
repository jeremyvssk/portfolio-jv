<?php
// POST /contact.php: takes the contact form and mails it to me. The site is a static export, so
// this is the only code that runs on the server; Zone serves PHP natively, a Node route would need
// its own always-on process.
//
// Sends through the host's own sendmail, so no API key. FROM must be an address on this domain or
// the receiving server treats it as spoofed and drops it; the visitor goes in Reply-To instead.
const TO = 'jvaaskj@gmail.com';
const FROM = 'noreply@jeremy.ee';
const LIMITS = ['name' => 80, 'email' => 160, 'message' => 4000];

header('Content-Type: application/json');

function reply(int $status, array $body): void {
  http_response_code($status);
  echo json_encode($body);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['error' => 'Method not allowed']);

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) reply(400, ['error' => 'Bad request']);

$str = fn(string $k) => is_string($body[$k] ?? null) ? trim($body[$k]) : '';
$name = $str('name');
$email = $str('email');
$message = $str('message');

// The honeypot: a real person never sees this field, so anything in it is a bot. Answer 200,
// because a rejection tells the script which field gave it away.
if ($str('leave_blank') !== '') reply(200, ['ok' => true]);

$tooLong = mb_strlen($name) > LIMITS['name'] || mb_strlen($email) > LIMITS['email']
  || mb_strlen($message) > LIMITS['message'];
// A line break in a header value would let a bot inject its own headers (Bcc: half the internet).
$broken = preg_match('/[\r\n]/', $name . $email);
if ($name === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $tooLong || $broken) {
  reply(400, ['error' => 'Check the fields']);
}

$subject = '=?UTF-8?B?' . base64_encode("Portfolio: $name") . '?=';
$headers = implode("\r\n", [
  'From: Portfolio <' . FROM . '>',
  "Reply-To: $email",
  'Content-Type: text/plain; charset=UTF-8',
]);

// -f sets the envelope sender, which is what SPF actually checks.
if (!mail(TO, $subject, "$name <$email>\n\n$message", $headers, '-f' . FROM)) {
  reply(502, ['error' => 'Send failed']);
}
reply(200, ['ok' => true]);
