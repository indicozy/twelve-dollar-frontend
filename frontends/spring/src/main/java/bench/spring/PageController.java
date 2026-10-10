package bench.spring;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/** The server-rendered pages. Every request calls the API and renders fresh data (no caching). */
@Controller
public class PageController {

	private final Api api;

	public PageController(Api api) {
		this.api = api;
	}

	@GetMapping("/")
	public String feed(@RequestParam(required = false) String error, Model model) {
		model.addAttribute("posts", api.feed());
		model.addAttribute("error", error);
		return "feed";
	}

	@GetMapping("/posts/{id}")
	public String post(@PathVariable String id, Model model, HttpServletResponse response) {
		Post post = api.post(id);
		if (post == null) {
			// A missing or invalid id renders the not-found page with a real 404.
			response.setStatus(HttpServletResponse.SC_NOT_FOUND);
			return "not-found";
		}
		model.addAttribute("post", post);
		return "post";
	}

	@GetMapping("/login")
	public String login() {
		return "login";
	}
}
