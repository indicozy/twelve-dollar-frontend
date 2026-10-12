package bench.spring;

import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ModelAttribute;

/** The header's signed-in name, read from the `token` cookie on every request (all pages, including the 404). */
@ControllerAdvice
public class Layout {

	private final Session session;

	public Layout(Session session) {
		this.session = session;
	}

	@ModelAttribute("username")
	public String username(@CookieValue(name = Session.TOKEN_COOKIE, required = false) String token) {
		return session.username(token);
	}
}
