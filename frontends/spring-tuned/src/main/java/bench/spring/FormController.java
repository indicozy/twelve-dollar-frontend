package bench.spring;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import tools.jackson.databind.json.JsonMapper;

/**
 * Plain HTML form posts (no JS): like, create and login. Each answers 303 (Post/Redirect/Get). Spring Web has no
 * CSRF/origin protection without Spring Security, so these routes apply the Next.js server-action rule, like the
 * Nuxt and Angular variants: if an Origin header is present, its host must equal the Host header, else 403.
 */
@Controller
public class FormController {

	private final Api api;
	private final Session session;
	private final JsonMapper json;

	public FormController(Api api, Session session, JsonMapper json) {
		this.api = api;
		this.session = session;
		this.json = json;
	}

	@PostMapping("/actions/like")
	public ResponseEntity<Void> like(HttpServletRequest request, @RequestParam(defaultValue = "") String id,
			@CookieValue(name = Session.TOKEN_COOKIE, required = false) String token) {
		if (!sameOrigin(request)) return forbidden();
		if (token == null) return seeOther("/login");
		api.likePost("Bearer " + token, id);
		return seeOther(backTo(request));
	}

	@PostMapping("/actions/create")
	public ResponseEntity<Void> create(HttpServletRequest request, @RequestParam(defaultValue = "") String body,
			@CookieValue(name = Session.TOKEN_COOKIE, required = false) String token) {
		if (!sameOrigin(request)) return forbidden();
		if (token == null) return seeOther("/login");
		var res = api.createPost("Bearer " + token, json.writeValueAsBytes(Map.of("body", body)));
		if (res.getStatusCode().value() != 201) {
			String error = "error " + res.getStatusCode().value();
			try {
				var node = json.readTree(res.getBody()).get("error");
				if (node != null && node.isString()) error = node.asString();
			} catch (RuntimeException ignored) {
			}
			return seeOther("/?error=" + URLEncoder.encode(error, StandardCharsets.UTF_8).replace("+", "%20"));
		}
		return seeOther("/");
	}

	@PostMapping("/login")
	public ResponseEntity<Void> login(HttpServletRequest request, @RequestParam(name = "user_id", defaultValue = "") String userId,
			@RequestParam(defaultValue = "") String username) {
		if (!sameOrigin(request)) return forbidden();
		long id;
		try {
			id = Long.parseLong(userId.trim());
		} catch (NumberFormatException e) {
			id = 0;
		}
		String name = username.trim();
		if (id < 1 || name.isEmpty()) return seeOther("/login?error=1");
		ResponseCookie cookie = ResponseCookie.from(Session.TOKEN_COOKIE, session.sign(id, name))
				.httpOnly(true).sameSite("Lax").path("/").build();
		return ResponseEntity.status(HttpStatus.SEE_OTHER).location(URI.create("/"))
				.header(HttpHeaders.SET_COOKIE, cookie.toString()).build();
	}

	static boolean sameOrigin(HttpServletRequest request) {
		String origin = request.getHeader(HttpHeaders.ORIGIN);
		if (origin == null) return true;
		try {
			String host = URI.create(origin).getRawAuthority();
			return host != null && host.equals(request.getHeader(HttpHeaders.HOST));
		} catch (IllegalArgumentException e) {
			return false;
		}
	}

	/** Same-origin path of the page the form was posted from (Referer), else "/". */
	private static String backTo(HttpServletRequest request) {
		String referer = request.getHeader(HttpHeaders.REFERER);
		if (referer == null) return "/";
		try {
			URI uri = URI.create(referer);
			String path = uri.getRawPath();
			return uri.getRawAuthority() != null && uri.getRawAuthority().equals(request.getHeader(HttpHeaders.HOST))
					&& path != null && path.startsWith("/") ? path : "/";
		} catch (IllegalArgumentException e) {
			return "/";
		}
	}

	private static ResponseEntity<Void> seeOther(String location) {
		return ResponseEntity.status(HttpStatus.SEE_OTHER).header(HttpHeaders.LOCATION, location).build();
	}

	private static ResponseEntity<Void> forbidden() {
		return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
	}
}
