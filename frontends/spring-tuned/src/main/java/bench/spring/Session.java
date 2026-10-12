package bench.spring;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Demo login tokens: the same HS256 JWTs as the challenge's seed/tokens.json and the SvelteKit variant. */
@Component
public class Session {

	public static final String TOKEN_COOKIE = "token";
	private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();

	private final byte[] secret;
	private final JsonMapper json;

	public Session(@Value("${app.jwt-secret}") String secret, JsonMapper json) {
		this.secret = secret.getBytes(StandardCharsets.UTF_8);
		this.json = json;
	}

	public String sign(long userId, String username) {
		long now = System.currentTimeMillis() / 1000;
		var payload = new java.util.LinkedHashMap<String, Object>();
		payload.put("sub", String.valueOf(userId));
		payload.put("username", username);
		payload.put("iat", now);
		payload.put("exp", now + 7 * 86400);
		String head = b64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
		String body = b64(json.writeValueAsBytes(payload));
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(secret, "HmacSHA256"));
			return head + "." + body + "." + b64(mac.doFinal((head + "." + body).getBytes(StandardCharsets.US_ASCII)));
		} catch (java.security.GeneralSecurityException e) {
			throw new IllegalStateException(e);
		}
	}

	/** The username in the token's payload (not verified, like the other variants), or null. */
	public String username(String token) {
		if (token == null) return null;
		try {
			String[] parts = token.split("\\.");
			JsonNode node = json.readTree(Base64.getUrlDecoder().decode(parts[1]));
			JsonNode name = node.get("username");
			return name == null || name.isNull() ? null : name.asString();
		} catch (RuntimeException e) {
			return null;
		}
	}

	private static String b64(byte[] bytes) {
		return B64.encodeToString(bytes);
	}
}
