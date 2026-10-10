package bench.spring;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Replaces Spring Boot's whitelabel error page (BasicErrorController backs off when an ErrorController bean exists).
 * Unknown paths reach here through Tomcat's error dispatch with status 404 and get the not-found page as HTML for
 * every client (Boot's default would send JSON to clients that don't ask for text/html, such as curl).
 */
@Controller
public class NotFoundController implements ErrorController {

	@RequestMapping("/error")
	public String error(HttpServletRequest request, HttpServletResponse response) {
		Object code = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
		int status = code instanceof Integer i ? i : 500;
		response.setStatus(status);
		return status == 404 ? "not-found" : "error";
	}
}
