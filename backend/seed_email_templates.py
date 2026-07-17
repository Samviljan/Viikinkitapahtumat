"""
Email templates that are auto-seeded into `db.email_templates` on backend
boot. Kept in a separate module so the multi-hundred-line HTML doesn't
clutter server.py.

Each entry is a dict with `name`, `subject`, `body`, `icon`, `color`.
Seeding is idempotent — an entry with the same `name` is skipped.

Placeholders for the newsletter substitution engine:
  {{first_name}} — recipient's first name (or "hyvä lukija" if unset)
  {{site_url}}   — https://viikinkitapahtumat.fi

To use these templates:
  Admin → Sisältö → Sähköpostipohjat → valitse "PWA-asennusohje" → Käytä pohjaa
"""

# Base URL that images in the email should point to. Emails travel outside
# the SPA so we need an absolute public URL that works in every mail client.
SITE_URL = "https://viikinkitapahtumat.fi"

_STYLE = """
<style>
  @media (max-width: 600px) {
    .container { width: 100% !important; padding: 20px 16px !important; }
    .step-card { padding: 18px 16px !important; }
    .step-image { max-height: 240px !important; }
    h1 { font-size: 26px !important; line-height: 1.15 !important; }
    h2 { font-size: 20px !important; }
  }
</style>
"""

def _pwa_email_html(site_url: str) -> str:
    """Build the PWA install guide HTML body. Kept as a function so image
    URLs can be swapped for testing/localhost."""
    android_img = f"{site_url}/article-images/pwa_guide_android_0325f007.jpg"
    ios_img = f"{site_url}/article-images/pwa_guide_ios_f9880829.jpg"
    home_img = f"{site_url}/article-images/pwa_guide_homescreen_694e497d.jpg"

    return f"""<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ota Viikinkitapahtumat käyttöön puhelimessa</title>
{_STYLE}
</head>
<body style="margin:0;padding:0;background:#0F0D0B;font-family:Georgia,'Cormorant Garamond',serif;color:#E8E2D5;">
  <div class="container" style="max-width:600px;margin:0 auto;background:#141111;padding:40px 32px;">

    <!-- Brand header -->
    <div style="text-align:center;padding-bottom:28px;border-bottom:1px solid #352A23;margin-bottom:32px;">
      <div style="font-family:'Cinzel',Georgia,serif;font-size:11px;letter-spacing:4px;color:#C19C4D;text-transform:uppercase;margin-bottom:8px;">
        VIIKINKITAPAHTUMAT
      </div>
      <img src="{home_img}" width="88" height="88" alt="Viikinki-sovelluksen ikoni"
           style="display:inline-block;width:88px;height:88px;border-radius:18px;border:1px solid #352A23;object-fit:cover;">
    </div>

    <!-- Hero -->
    <div style="text-align:left;">
      <div style="font-family:'Cinzel',Georgia,serif;font-size:10px;letter-spacing:2px;color:#C19C4D;text-transform:uppercase;margin-bottom:12px;">
        Uusi ominaisuus · Asennusohje
      </div>
      <h1 style="font-family:Georgia,serif;color:#E8E2D5;font-size:32px;line-height:1.15;margin:0 0 18px 0;font-weight:normal;">
        Ota Viikinkitapahtumat käyttöön puhelimessa
      </h1>
      <p style="color:#B9AC97;font-size:16px;line-height:1.7;margin:0 0 32px 0;">
        Hei {{{{first_name}}}}!<br><br>
        Voit nyt asentaa <strong style="color:#E8E2D5;">viikinkitapahtumat.fi</strong>-sivuston
        aloitusnäytöllesi kuten minkä tahansa sovelluksen — ilman Google Playta tai App Storea.
        Se tarkoittaa nopeampaa käynnistystä, oman kuvakkeen sekä
        <strong style="color:#E8E2D5;">tapahtumakalenterin selailua myös offline-tilassa</strong>.
      </p>
    </div>

    <!-- Why install? -->
    <div style="background:#1A1614;border:1px solid #352A23;padding:20px 22px;margin-bottom:36px;">
      <div style="font-family:'Cinzel',Georgia,serif;font-size:10px;letter-spacing:2px;color:#C19C4D;text-transform:uppercase;margin-bottom:12px;">
        Miksi asentaa?
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;color:#B9AC97;font-size:14px;line-height:1.6;">
        <tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;width:26px;color:#C19C4D;font-weight:bold;">•</td>
          <td style="padding:6px 0;">Kalenteri toimii myös verkon katketessa — tallennetut tapahtumat pysyvät luettavina</td>
        </tr>
        <tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;color:#C19C4D;font-weight:bold;">•</td>
          <td style="padding:6px 0;">Oma kuvake aloitusnäytöllä — ei tarvitse muistaa osoitetta</td>
        </tr>
        <tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;color:#C19C4D;font-weight:bold;">•</td>
          <td style="padding:6px 0;">Nopeampi käynnistys ja täyskuvatila (ei selainpalkkia)</td>
        </tr>
        <tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;color:#C19C4D;font-weight:bold;">•</td>
          <td style="padding:6px 0;">Vie noin 500 kt tilaa — murto-osan siitä mitä natiivit sovellukset</td>
        </tr>
      </table>
    </div>

    <!-- ANDROID -->
    <div style="margin-bottom:40px;">
      <div style="display:inline-block;background:#C19C4D;color:#141111;padding:6px 14px;font-family:'Cinzel',Georgia,serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">
        📱 Android · Chrome-selain
      </div>
      <h2 style="font-family:Georgia,serif;color:#E8E2D5;font-size:22px;margin:0 0 20px 0;font-weight:normal;">
        Asennus Android-puhelimeen
      </h2>

      <img src="{android_img}" alt="Android Chrome -selaimen install-banneri"
           class="step-image"
           style="width:100%;max-width:560px;height:auto;max-height:340px;object-fit:cover;border:1px solid #352A23;margin-bottom:20px;">

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td class="step-card" style="background:#1A1614;border:1px solid #352A23;padding:20px 22px;">
            <div style="color:#B9AC97;font-size:15px;line-height:1.65;">
              <p style="margin:0 0 14px 0;">
                <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#C19C4D;color:#141111;border-radius:50%;font-weight:bold;font-size:13px;margin-right:10px;vertical-align:middle;">1</span>
                Avaa Chrome-selain ja mene osoitteeseen
                <a href="{site_url}" style="color:#C19C4D;text-decoration:none;">viikinkitapahtumat.fi</a>
              </p>
              <p style="margin:0 0 14px 0;">
                <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#C19C4D;color:#141111;border-radius:50%;font-weight:bold;font-size:13px;margin-right:10px;vertical-align:middle;">2</span>
                Näet alalaidassa keltaisen <strong style="color:#E8E2D5;">"Asenna sovellus"</strong> -painikkeen — paina sitä
              </p>
              <p style="margin:0;">
                <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#C19C4D;color:#141111;border-radius:50%;font-weight:bold;font-size:13px;margin-right:10px;vertical-align:middle;">3</span>
                Chrome kysyy vahvistuksen → paina uudelleen <strong style="color:#E8E2D5;">Asenna</strong>. Sovellus ilmestyy aloitusnäytöllesi.
              </p>
            </div>
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid #352A23;color:#8E8276;font-size:12px;line-height:1.5;">
              💡 <strong style="color:#B9AC97;">Vinkki:</strong> Jos painiketta ei näy, avaa Chromen valikko (kolme pistettä oikeassa yläkulmassa) ja valitse "Asenna sovellus" tai "Lisää aloitusnäyttöön".
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- iOS -->
    <div style="margin-bottom:40px;">
      <div style="display:inline-block;background:#C19C4D;color:#141111;padding:6px 14px;font-family:'Cinzel',Georgia,serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">
        🍎 iPhone · Safari-selain
      </div>
      <h2 style="font-family:Georgia,serif;color:#E8E2D5;font-size:22px;margin:0 0 20px 0;font-weight:normal;">
        Asennus iPhoneen
      </h2>

      <img src="{ios_img}" alt="iOS Safari Share -valikon Add to Home Screen -kohta"
           class="step-image"
           style="width:100%;max-width:560px;height:auto;max-height:340px;object-fit:cover;border:1px solid #352A23;margin-bottom:20px;">

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td class="step-card" style="background:#1A1614;border:1px solid #352A23;padding:20px 22px;">
            <div style="color:#B9AC97;font-size:15px;line-height:1.65;">
              <p style="margin:0 0 14px 0;">
                <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#C19C4D;color:#141111;border-radius:50%;font-weight:bold;font-size:13px;margin-right:10px;vertical-align:middle;">1</span>
                Avaa <strong style="color:#E8E2D5;">Safari</strong> (ei Chrome — tämä toimii vain Safarissa iOS:llä) ja mene osoitteeseen
                <a href="{site_url}" style="color:#C19C4D;text-decoration:none;">viikinkitapahtumat.fi</a>
              </p>
              <p style="margin:0 0 14px 0;">
                <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#C19C4D;color:#141111;border-radius:50%;font-weight:bold;font-size:13px;margin-right:10px;vertical-align:middle;">2</span>
                Paina alapalkin keskellä olevaa <strong style="color:#E8E2D5;">Jaa-painiketta</strong> (neliö, jossa nuoli osoittaa ylös ↑)
              </p>
              <p style="margin:0 0 14px 0;">
                <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#C19C4D;color:#141111;border-radius:50%;font-weight:bold;font-size:13px;margin-right:10px;vertical-align:middle;">3</span>
                Vieritä listaa alaspäin ja valitse <strong style="color:#E8E2D5;">"Lisää aloitusnäyttöön"</strong> (Add to Home Screen)
              </p>
              <p style="margin:0;">
                <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#C19C4D;color:#141111;border-radius:50%;font-weight:bold;font-size:13px;margin-right:10px;vertical-align:middle;">4</span>
                Paina oikeassa yläkulmassa <strong style="color:#E8E2D5;">Lisää</strong>. Kuvake ilmestyy aloitusnäytölle.
              </p>
            </div>
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid #352A23;color:#8E8276;font-size:12px;line-height:1.5;">
              💡 <strong style="color:#B9AC97;">Vinkki:</strong> iOS 16.4 tai uudempi tarvitaan täyden toimivuuden vuoksi. Voit halutessasi myös vetää lopulliseen kohtaan aloitusnäytöllä pitämällä sovellusta painettuna.
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Result -->
    <div style="text-align:center;margin-bottom:40px;padding:28px 20px;background:#1A1614;border:1px solid #352A23;">
      <div style="font-family:'Cinzel',Georgia,serif;font-size:10px;letter-spacing:2px;color:#C19C4D;text-transform:uppercase;margin-bottom:14px;">
        Näin sovellus näyttää asennuksen jälkeen
      </div>
      <img src="{home_img}" alt="Viikinki-sovelluksen kuvake aloitusnäytöllä"
           style="max-width:280px;width:100%;height:auto;border:1px solid #352A23;margin-bottom:16px;">
      <p style="color:#B9AC97;font-size:14px;line-height:1.6;margin:0;">
        Kultainen Fehu-riimu tunnistettavassa muodossa —<br>
        yksi klikkaus ja koko tapahtumakalenteri on käytössäsi.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:36px;">
      <a href="{site_url}"
         style="display:inline-block;background:#C8492C;color:#E8E2D5;padding:14px 32px;text-decoration:none;font-family:'Cinzel',Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;border:1px solid #C8492C;">
        Aloita nyt puhelimellasi &rarr;
      </a>
      <p style="margin:14px 0 0 0;color:#8E8276;font-size:12px;">
        {site_url.replace('https://', '')}
      </p>
    </div>

    <!-- Support -->
    <div style="border-top:1px solid #352A23;padding-top:24px;color:#8E8276;font-size:13px;line-height:1.6;text-align:center;">
      <p style="margin:0 0 8px 0;">
        Kysymyksiä? Vastaa tähän viestiin tai kirjoita
        <a href="mailto:admin@viikinkitapahtumat.fi" style="color:#C19C4D;text-decoration:none;">admin@viikinkitapahtumat.fi</a>
      </p>
      <p style="margin:0;font-family:'Cinzel',Georgia,serif;font-size:10px;letter-spacing:2px;color:#5A5148;">
        BI ÖLLUM VÉUM HEILIR
      </p>
    </div>

  </div>
</body>
</html>"""


DEFAULT_EMAIL_TEMPLATES = [
    {
        "name": "PWA-asennusohje (puhelimeen)",
        "subject": "Ota Viikinkitapahtumat käyttöön puhelimessasi — asennusohje",
        "body": _pwa_email_html(SITE_URL),
        "icon": "Smartphone",
        "color": "#C19C4D",
    },
]
